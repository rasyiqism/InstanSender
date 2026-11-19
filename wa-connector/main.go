package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	waStore "go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

const maxMediaBytes = 15 << 20

// Session holds one device's whatsmeow client plus its latest QR code.
type Session struct {
	Client *whatsmeow.Client
	mu     sync.RWMutex
	qr     string
	status string // pending_qr | connected | disconnected | logged_out
	phone  string
}

func (s *Session) setQR(qr string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.qr = qr
	s.status = "pending_qr"
}

func (s *Session) setStatus(status, phone string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status = status
	if phone != "" {
		s.phone = phone
	} else if status == "disconnected" || status == "logged_out" {
		s.phone = ""
	}
	if status == "connected" {
		s.qr = ""
	}
}

func (s *Session) snapshot() (qr, status, phone string) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.qr, s.status, s.phone
}

type Manager struct {
	container *sqlstore.Container
	mu        sync.RWMutex
	sessions  map[string]*Session // deviceId -> session

	backendURL    string
	internalToken string
	mediaUploader *R2Uploader // nil = media upload disabled
}

func NewManager(dbPath, backendURL, internalToken string, mediaUploader *R2Uploader) (*Manager, error) {
	container, err := sqlstore.New(context.Background(), "sqlite3", "file:"+dbPath+"?_foreign_keys=on", waLog.Noop)
	if err != nil {
		return nil, err
	}
	return &Manager{
		container:     container,
		sessions:      map[string]*Session{},
		backendURL:    backendURL,
		internalToken: internalToken,
		mediaUploader: mediaUploader,
	}, nil
}

func (m *Manager) addEventHandler(deviceID string, client *whatsmeow.Client, sess *Session) {
	client.AddEventHandler(func(evt interface{}) {
		switch e := evt.(type) {
		case *events.Connected:
			phone := ""
			if client.Store.ID != nil {
				phone = client.Store.ID.User
			}
			sess.setStatus("connected", phone)
			m.notifyBackend(deviceID, "connected", phone)
		case *events.Disconnected:
			sess.setStatus("disconnected", "")
			m.notifyBackend(deviceID, "disconnected", "")
		case *events.LoggedOut:
			_ = e
			sess.setStatus("logged_out", "")
			m.notifyBackend(deviceID, "logged_out", "")
		case *events.Message:
			if e.Info.IsFromMe {
				return
			}
			m.notifyIncomingMessage(deviceID, e)
		}
	})
}

// notifyBackend posts device status changes to the main backend.
func (m *Manager) notifyBackend(deviceID, status, phone string) {
	if m.backendURL == "" {
		return
	}
	body, _ := json.Marshal(map[string]string{
		"deviceId":    deviceID,
		"status":      status,
		"phoneNumber": phone,
	})
	req, err := http.NewRequest("POST", m.backendURL+"/devices/internal/events", strings.NewReader(string(body)))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", m.internalToken)
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("notifyBackend failed device=%s: %v", deviceID, err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		log.Printf("notifyBackend failed device=%s status=%d body=%s", deviceID, resp.StatusCode, strings.TrimSpace(string(data)))
	}
}

func jidUser(jid types.JID) string {
	if jid.User != "" {
		return jid.User
	}
	return jid.String()
}

// pnFromSender resolves the sender to a phone number.
// WhatsApp may address DMs using a LID JID (server="lid", opaque User like 265205858734081)
// instead of a PN JID (server="s.whatsapp.net", User = phone number).
// AddressingMode is not always populated, so we check the Sender server directly.
// When Sender is a LID, the real phone number is in SenderAlt.
func pnFromSender(src types.MessageSource) string {
	// Sender is a LID → use SenderAlt which contains the real phone number
	if src.Sender.Server == types.HiddenUserServer && src.SenderAlt.User != "" {
		return src.SenderAlt.User
	}
	// Sender is a normal PN JID
	if src.Sender.User != "" {
		return src.Sender.User
	}
	// fallback
	if src.SenderAlt.User != "" {
		return src.SenderAlt.User
	}
	return src.Chat.String()
}

func messageContent(msg *waProto.Message) (messageType, text, caption string) {
	if msg == nil {
		return "unknown", "", ""
	}
	switch {
	case msg.GetConversation() != "":
		return "text", msg.GetConversation(), ""
	case msg.GetExtendedTextMessage() != nil:
		return "text", msg.GetExtendedTextMessage().GetText(), ""
	case msg.GetImageMessage() != nil:
		return "image", "", msg.GetImageMessage().GetCaption()
	case msg.GetVideoMessage() != nil:
		return "video", "", msg.GetVideoMessage().GetCaption()
	case msg.GetDocumentMessage() != nil:
		return "document", "", msg.GetDocumentMessage().GetCaption()
	case msg.GetAudioMessage() != nil:
		return "audio", "", ""
	case msg.GetStickerMessage() != nil:
		return "sticker", "", ""
	case msg.GetLocationMessage() != nil:
		return "location", "", ""
	case msg.GetContactMessage() != nil || msg.GetContactsArrayMessage() != nil:
		return "contact", "", ""
	default:
		return "unknown", "", ""
	}
}

// downloadableFromMessage extracts the downloadable sub-message (for
// client.Download) plus its mimetype and a file extension. Returns a nil
// message when there is no media to download.
func downloadableFromMessage(msg *waProto.Message) (whatsmeow.DownloadableMessage, string, string) {
	if msg == nil {
		return nil, "", ""
	}
	switch {
	case msg.GetImageMessage() != nil:
		m := msg.GetImageMessage()
		return m, m.GetMimetype(), extFromMimetype(m.GetMimetype(), "jpg")
	case msg.GetVideoMessage() != nil:
		m := msg.GetVideoMessage()
		return m, m.GetMimetype(), extFromMimetype(m.GetMimetype(), "mp4")
	case msg.GetAudioMessage() != nil:
		m := msg.GetAudioMessage()
		return m, m.GetMimetype(), extFromMimetype(m.GetMimetype(), "ogg")
	case msg.GetDocumentMessage() != nil:
		m := msg.GetDocumentMessage()
		if name := m.GetFileName(); name != "" && strings.Contains(name, ".") {
			return m, m.GetMimetype(), extFromFileName(name)
		}
		return m, m.GetMimetype(), extFromMimetype(m.GetMimetype(), "bin")
	case msg.GetStickerMessage() != nil:
		m := msg.GetStickerMessage()
		return m, m.GetMimetype(), extFromMimetype(m.GetMimetype(), "webp")
	default:
		return nil, "", ""
	}
}

// extFromMimetype derives a short file extension from a MIME type, falling back
// to `fallback` when the type is unknown or missing.
func extFromMimetype(mimeType, fallback string) string {
	mimeType = strings.ToLower(strings.TrimSpace(mimeType))
	switch mimeType {
	case "image/jpeg", "image/jpg":
		return "jpg"
	case "image/png":
		return "png"
	case "image/webp":
		return "webp"
	case "image/gif":
		return "gif"
	case "video/mp4":
		return "mp4"
	case "audio/ogg", "audio/ogg; codecs=opus":
		return "ogg"
	case "audio/mpeg", "audio/mp3":
		return "mp3"
	case "application/pdf":
		return "pdf"
	}
	if i := strings.Index(mimeType, "/"); i > 0 && i < len(mimeType)-1 {
		return mimeType[i+1:]
	}
	return fallback
}

// extFromFileName returns the extension (without dot) of a file name.
func extFromFileName(name string) string {
	if i := strings.LastIndex(name, "."); i >= 0 && i < len(name)-1 {
		return strings.ToLower(name[i+1:])
	}
	return "bin"
}

// downloadAndUpload fetches the media bytes from WhatsApp and uploads them to R2.
func (m *Manager) downloadAndUpload(deviceID string, evt *events.Message, dl whatsmeow.DownloadableMessage, mimeType, ext string) (string, error) {
	sess, ok := m.Get(deviceID)
	if !ok || sess.Client == nil || !sess.Client.IsConnected() {
		return "", fmt.Errorf("device not connected")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	data, err := sess.Client.Download(ctx, dl)
	if err != nil {
		return "", fmt.Errorf("download media: %w", err)
	}
	return m.mediaUploader.Upload(ctx, data, mimeType, ext)
}

func (m *Manager) notifyIncomingMessage(deviceID string, evt *events.Message) {
	if m.backendURL == "" || evt == nil {
		return
	}

	messageType, text, caption := messageContent(evt.Message)

	// Debug: log raw JID fields to diagnose LID vs PN.
	log.Printf("[msg] Sender=%s SenderAlt=%s Chat=%s AddressingMode=%s Type=%s TextLen=%d CaptionLen=%d",
		evt.Info.Sender.String(),
		evt.Info.SenderAlt.String(),
		evt.Info.Chat.String(),
		evt.Info.AddressingMode,
		messageType,
		len(text),
		len(caption),
	)

	from := pnFromSender(evt.Info.MessageSource)
	if from == "" {
		from = jidUser(evt.Info.Chat)
	}
	payload := map[string]interface{}{
		"deviceId":  deviceID,
		"messageId": evt.Info.ID,
		"from":      from,
		"chat":      jidUser(evt.Info.Chat),
		"isGroup":   evt.Info.IsGroup,
		"fromMe":    evt.Info.IsFromMe,
		"pushName":  evt.Info.PushName,
		"type":      messageType,
		"timestamp": evt.Info.Timestamp.Format(time.RFC3339),
	}
	if text != "" {
		payload["message"] = text
	}
	if caption != "" {
		payload["caption"] = caption
	}

	// Download media from personal chats (not groups) and upload to R2.
	// Best-effort: failures are logged and the payload is still delivered
	// without mediaUrl so no incoming message is ever dropped.
	if !evt.Info.IsGroup && m.mediaUploader != nil {
		if dl, mimeType, ext := downloadableFromMessage(evt.Message); dl != nil {
			mediaURL, err := m.downloadAndUpload(deviceID, evt, dl, mimeType, ext)
			if err != nil {
				log.Printf("[msg] media upload failed device=%s message=%s: %v", deviceID, evt.Info.ID, err)
			} else {
				payload["mediaUrl"] = mediaURL
			}
		}
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", m.backendURL+"/devices/internal/incoming", strings.NewReader(string(body)))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", m.internalToken)
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("notifyIncomingMessage failed device=%s message=%s: %v", deviceID, evt.Info.ID, err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		log.Printf("notifyIncomingMessage failed device=%s message=%s status=%d body=%s", deviceID, evt.Info.ID, resp.StatusCode, strings.TrimSpace(string(data)))
	} else {
		log.Printf("notifyIncomingMessage delivered device=%s message=%s from=%s type=%s", deviceID, evt.Info.ID, from, messageType)
	}
}

// CreateSession starts a new whatsmeow session for a device and begins the QR loop.
func (m *Manager) CreateSession(deviceID string) (*Session, error) {
	m.mu.Lock()
	if existing, ok := m.sessions[deviceID]; ok {
		_, status, _ := existing.snapshot()
		if status == "logged_out" || status == "disconnected" {
			delete(m.sessions, deviceID)
			if existing.Client != nil {
				existing.Client.Disconnect()
				if existing.Client.Store != nil && existing.Client.Store.ID != nil {
					_ = existing.Client.Store.Delete(context.Background())
				}
			}
		} else {
			m.mu.Unlock()
			return existing, nil
		}
	}
	m.mu.Unlock()

	device := m.container.NewDevice()
	client := whatsmeow.NewClient(device, waLog.Stdout("wa/"+deviceID[:8], "INFO", true))
	sess := &Session{Client: client, status: "pending_qr"}

	m.mu.Lock()
	if existing, ok := m.sessions[deviceID]; ok {
		m.mu.Unlock()
		return existing, nil
	}
	m.sessions[deviceID] = sess
	m.mu.Unlock()

	m.addEventHandler(deviceID, client, sess)

	qrChan, err := client.GetQRChannel(context.Background())
	if err != nil {
		return nil, err
	}
	if err := client.Connect(); err != nil {
		return nil, err
	}
	go func() {
		for item := range qrChan {
			if item.Event == "code" {
				sess.setQR(item.Code)
			}
		}
	}()
	return sess, nil
}

func (m *Manager) EnsureConnected(deviceID string) (*Session, error) {
	if sess, ok := m.Get(deviceID); ok {
		if sess.Client != nil && sess.Client.IsConnected() && sess.Client.IsLoggedIn() {
			return sess, nil
		}
	}

	devices, err := m.container.GetAllDevices(context.Background())
	if err != nil {
		return nil, err
	}
	if len(devices) == 0 {
		return nil, fmt.Errorf("session not found")
	}

	device := devices[0]
	client := whatsmeow.NewClient(device, waLog.Stdout("wa/"+deviceID[:8], "INFO", true))
	sess := &Session{Client: client, status: "disconnected"}
	m.addEventHandler(deviceID, client, sess)

	m.mu.Lock()
	m.sessions[deviceID] = sess
	m.mu.Unlock()

	if err := client.Connect(); err != nil {
		return nil, err
	}
	for i := 0; i < 20; i++ {
		if client.IsConnected() && client.IsLoggedIn() {
			phone := ""
			if client.Store.ID != nil {
				phone = client.Store.ID.User
			}
			sess.setStatus("connected", phone)
			m.notifyBackend(deviceID, "connected", phone)
			return sess, nil
		}
		time.Sleep(500 * time.Millisecond)
	}
	return sess, fmt.Errorf("device not connected")
}

func (m *Manager) Get(deviceID string) (*Session, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.sessions[deviceID]
	return s, ok
}

func (m *Manager) Delete(deviceID string) {
	m.mu.Lock()
	sess, ok := m.sessions[deviceID]
	delete(m.sessions, deviceID)
	m.mu.Unlock()
	if ok && sess.Client != nil {
		_ = sess.Client.Logout(context.Background())
		sess.Client.Disconnect()
	}
}

// --- HTTP layer ---

type server struct {
	manager *Manager
	token   string
}

func (s *server) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+s.token {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// deviceID extracts the {id} segment of /internal/wa/device/{id}/...
func deviceID(path string) string {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	// internal wa device <id> <action>
	if len(parts) >= 4 {
		return parts[3]
	}
	return ""
}

// connectedClient resolves a connected whatsmeow client for a device,
// restoring the session via EnsureConnected when needed. Mirrors handleSend.
func (s *server) connectedClient(w http.ResponseWriter, r *http.Request, deviceID string) (*whatsmeow.Client, bool) {
	sess, ok := s.manager.Get(deviceID)
	if !ok || sess.Client == nil || !sess.Client.IsConnected() {
		var err error
		sess, err = s.manager.EnsureConnected(deviceID)
		if err != nil {
			writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
			return nil, false
		}
	}
	if sess.Client == nil || !sess.Client.IsConnected() {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "device not connected"})
		return nil, false
	}
	return sess.Client, true
}

type groupSummary struct {
	JID              string `json:"jid"`
	Name             string `json:"name"`
	ParticipantCount int    `json:"participantCount"`
}

// handleGroups lists the groups the device has joined.
// GET /internal/wa/groups?deviceId=<id>
func (s *server) handleGroups(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	deviceID := r.URL.Query().Get("deviceId")
	if deviceID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "deviceId is required"})
		return
	}

	client, ok := s.connectedClient(w, r, deviceID)
	if !ok {
		return
	}

	groups, err := client.GetJoinedGroups(r.Context())
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	out := make([]groupSummary, 0, len(groups))
	for _, g := range groups {
		out = append(out, groupSummary{
			JID:              g.JID.String(),
			Name:             g.Name,
			ParticipantCount: g.ParticipantCount,
		})
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"groups": out})
}

type groupMember struct {
	Phone        string `json:"phone"`
	JID          string `json:"jid"`
	LID          string `json:"lid"`
	IsAdmin      bool   `json:"isAdmin"`
	IsSuperAdmin bool   `json:"isSuperAdmin"`
	DisplayName  string `json:"displayName"`
}

// handleGroupMembers returns the participant list of a single group.
// GET /internal/wa/group/members?deviceId=<id>&jid=<groupJid>
func (s *server) handleGroupMembers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	deviceID := r.URL.Query().Get("deviceId")
	jidStr := r.URL.Query().Get("jid")
	if deviceID == "" || jidStr == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "deviceId and jid are required"})
		return
	}

	jid, err := types.ParseJID(jidStr)
	if err != nil || jid.Server != types.GroupServer || jid.User == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid group jid"})
		return
	}

	client, ok := s.connectedClient(w, r, deviceID)
	if !ok {
		return
	}

	info, err := client.GetGroupInfo(r.Context(), jid)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	members := make([]groupMember, 0, len(info.Participants))
	// Best-effort: enrich displayName with the verified business name via
	// GetUserInfo. WhatsApp does not expose push names via query, so only
	// verified business accounts (and the obfuscated announcement DisplayName)
	// can carry a name here. Failures fall back to an empty name.
	businessNames := map[string]string{}
	queryJIDs := make([]types.JID, 0, len(info.Participants))
	for _, p := range info.Participants {
		// GetUserInfo works on phone-number JIDs; prefer PhoneNumber, else JID.
		qj := p.PhoneNumber
		if qj.User == "" {
			qj = p.JID
		}
		if qj.User != "" && qj.Server == types.DefaultUserServer {
			queryJIDs = append(queryJIDs, qj)
		}
	}
	if len(queryJIDs) > 0 {
		userInfo, err := client.GetUserInfo(r.Context(), queryJIDs)
		if err == nil {
			for jid, ui := range userInfo {
				if ui.VerifiedName != nil && ui.VerifiedName.Details != nil {
					name := ui.VerifiedName.Details.GetVerifiedName()
					if name != "" {
						businessNames[jid.String()] = name
					}
				}
			}
		}
	}

	for _, p := range info.Participants {
		// Prefer the phone-number JID; fall back to the primary JID, then LID.
		phone := ""
		if p.PhoneNumber.User != "" {
			phone = p.PhoneNumber.User
		} else if p.JID.User != "" {
			phone = p.JID.User
		}
		// DisplayName: verified business name (best-effort), else the group's
		// obfuscated DisplayName for anonymous announcement participants.
		displayName := p.DisplayName
		if displayName == "" {
			key := p.PhoneNumber
			if key.User == "" {
				key = p.JID
			}
			if name, ok := businessNames[key.String()]; ok {
				displayName = name
			}
		}
		members = append(members, groupMember{
			Phone:        phone,
			JID:          p.JID.String(),
			LID:          p.LID.String(),
			IsAdmin:      p.IsAdmin,
			IsSuperAdmin: p.IsSuperAdmin,
			DisplayName:  displayName,
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"groupId":          info.JID.String(),
		"groupName":        info.Name,
		"participantCount": info.ParticipantCount,
		"participants":     members,
	})
}

type sendRequest struct {
	DeviceID string `json:"deviceId"`
	To       string `json:"to"`
	Type     string `json:"type"`
	Message  string `json:"message"`
	MediaURL string `json:"mediaUrl"`
	Caption  string `json:"caption"`
}

func fetchImage(ctx context.Context, mediaURL string) ([]byte, string, uint32, uint32, error) {
	if mediaURL == "" {
		return nil, "", 0, 0, fmt.Errorf("mediaUrl is required for image messages")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, mediaURL, nil)
	if err != nil {
		return nil, "", 0, 0, err
	}
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", 0, 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", 0, 0, fmt.Errorf("mediaUrl returned HTTP %d", resp.StatusCode)
	}
	if resp.ContentLength > maxMediaBytes {
		return nil, "", 0, 0, fmt.Errorf("image exceeds %d bytes", maxMediaBytes)
	}

	limited := io.LimitReader(resp.Body, maxMediaBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		return nil, "", 0, 0, err
	}
	if len(data) > maxMediaBytes {
		return nil, "", 0, 0, fmt.Errorf("image exceeds %d bytes", maxMediaBytes)
	}

	mimetype := resp.Header.Get("Content-Type")
	if idx := strings.Index(mimetype, ";"); idx >= 0 {
		mimetype = strings.TrimSpace(mimetype[:idx])
	}
	if mimetype == "" || !strings.HasPrefix(mimetype, "image/") {
		mimetype = http.DetectContentType(data)
	}
	if !strings.HasPrefix(mimetype, "image/") {
		return nil, "", 0, 0, fmt.Errorf("mediaUrl content is not an image")
	}

	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return data, mimetype, 0, 0, nil
	}
	return data, mimetype, uint32(cfg.Width), uint32(cfg.Height), nil
}

func (s *server) handleSend(w http.ResponseWriter, r *http.Request) {
	var req sendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	sess, ok := s.manager.Get(req.DeviceID)
	if !ok || sess.Client == nil || !sess.Client.IsConnected() {
		var err error
		sess, err = s.manager.EnsureConnected(req.DeviceID)
		if err != nil {
			writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
			return
		}
	}
	if sess.Client == nil || !sess.Client.IsConnected() {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "device not connected"})
		return
	}

	jid := types.NewJID(req.To, types.DefaultUserServer)
	var msg *waProto.Message

	switch req.Type {
	case "text":
		msg = &waProto.Message{Conversation: proto.String(req.Message)}
	case "image":
		data, mimetype, width, height, err := fetchImage(r.Context(), req.MediaURL)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		upload, err := sess.Client.Upload(r.Context(), data, whatsmeow.MediaImage)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}
		imageMsg := &waProto.ImageMessage{
			Caption:       proto.String(req.Caption),
			Mimetype:      proto.String(mimetype),
			URL:           proto.String(upload.URL),
			DirectPath:    proto.String(upload.DirectPath),
			MediaKey:      upload.MediaKey,
			FileEncSHA256: upload.FileEncSHA256,
			FileSHA256:    upload.FileSHA256,
			FileLength:    proto.Uint64(upload.FileLength),
		}
		if width > 0 {
			imageMsg.Width = proto.Uint32(width)
		}
		if height > 0 {
			imageMsg.Height = proto.Uint32(height)
		}
		msg = &waProto.Message{ImageMessage: imageMsg}
	case "document":
		writeJSON(w, http.StatusNotImplemented, map[string]string{"error": "document messages are not implemented yet"})
		return
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown type"})
		return
	}

	resp, err := sess.Client.SendMessage(r.Context(), jid, msg)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"messageId": resp.ID})
}

func (s *server) handleDevice(w http.ResponseWriter, r *http.Request) {
	id := deviceID(r.URL.Path)
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing device id"})
		return
	}

	switch {
	case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/session"):
		sess, err := s.manager.CreateSession(id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		// QR usually arrives within ~1s of connect; give it a moment
		time.Sleep(1500 * time.Millisecond)
		qr, _, _ := sess.snapshot()
		writeJSON(w, http.StatusOK, map[string]interface{}{"qr": nullable(qr)})

	case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/qr"):
		sess, ok := s.manager.Get(id)
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "session not found"})
			return
		}
		qr, status, _ := sess.snapshot()
		writeJSON(w, http.StatusOK, map[string]interface{}{"qr": nullable(qr), "status": status})

	case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/status"):
		sess, ok := s.manager.Get(id)
		if !ok {
			s.manager.notifyBackend(id, "reconnecting", "")
			restored, err := s.manager.EnsureConnected(id)
			if err != nil {
				writeJSON(w, http.StatusOK, map[string]string{"status": "disconnected"})
				return
			}
			sess = restored
		}
		_, status, phone := sess.snapshot()
		if sess.Client == nil || !sess.Client.IsConnected() {
			if status == "connected" {
				status = "disconnected"
				sess.setStatus(status, "")
				s.manager.notifyBackend(id, status, "")
			}
		} else if sess.Client.IsLoggedIn() {
			derivedPhone := phone
			if sess.Client.Store.ID != nil {
				derivedPhone = sess.Client.Store.ID.User
			}
			if status != "connected" || derivedPhone != phone {
				status = "connected"
				phone = derivedPhone
				sess.setStatus(status, phone)
				s.manager.notifyBackend(id, status, phone)
			}
		} else if status == "connected" {
			status = "logged_out"
			sess.setStatus(status, "")
			s.manager.notifyBackend(id, status, "")
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": status, "phoneNumber": phone})

	case r.Method == http.MethodDelete && strings.HasSuffix(r.URL.Path, "/session"):
		s.manager.Delete(id)
		writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})

	default:
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	}
}

func nullable(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func configureLinkedDeviceName() {
	name := env("WA_DEVICE_NAME", "Simple Sender")
	waStore.DeviceProps.Os = proto.String(name)
}

func main() {
	configureLinkedDeviceName()

	port := env("PORT", "8080")
	host := env("HOST", "0.0.0.0")
	token := env("INTERNAL_TOKEN", "internal-shared-secret")
	dbPath := env("SESSION_DB", "wa-sessions.db")
	backendURL := env("BACKEND_URL", "http://127.0.0.1:3000")

	mediaUploader, err := NewR2Uploader(context.Background())
	if err != nil {
		log.Fatalf("failed to init R2 uploader: %v", err)
	}
	if mediaUploader != nil {
		log.Printf("R2 media upload enabled (bucket: %s, public: %s)",
			env("R2_BUCKET", ""), env("R2_PUBLIC_BASE_URL", ""))
	} else {
		log.Printf("R2 media upload disabled (set R2_* env vars to enable)")
	}

	manager, err := NewManager(dbPath, backendURL, token, mediaUploader)
	if err != nil {
		log.Fatalf("failed to init session store: %v", err)
	}

	srv := &server{manager: manager, token: token}
	mux := http.NewServeMux()
	mux.HandleFunc("/internal/wa/send", srv.auth(srv.handleSend))
	mux.HandleFunc("/internal/wa/device/", srv.auth(srv.handleDevice))
	mux.HandleFunc("/internal/wa/groups", srv.auth(srv.handleGroups))
	mux.HandleFunc("/internal/wa/group/members", srv.auth(srv.handleGroupMembers))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	log.Printf("WA Connector Service listening on %s:%s (backend: %s)", host, port, backendURL)
	log.Fatal(http.ListenAndServe(fmt.Sprintf("%s:%s", host, port), mux))
}
