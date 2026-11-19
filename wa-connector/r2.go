package main

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

// R2Uploader stores WhatsApp media files in a Cloudflare R2 bucket (S3-compatible)
// and returns public URLs to embed in incoming-message webhooks.
//
// Auto-deletion is handled by an R2 Lifecycle Rule on the bucket (e.g. delete
// objects after 30 days), not in code — see wa-connector/README.md for setup.
type R2Uploader struct {
	client        *s3.Client
	uploader      *manager.Uploader
	bucket        string
	publicBaseURL string
}

// NewR2Uploader builds an uploader from R2_* env vars. Returns nil (feature
// disabled) when any required var is missing, so the connector still runs
// without media uploads.
func NewR2Uploader(ctx context.Context) (*R2Uploader, error) {
	bucket := env("R2_BUCKET", "")
	endpoint := env("R2_ENDPOINT", "")
	publicBaseURL := strings.TrimRight(env("R2_PUBLIC_BASE_URL", ""), "/")
	accessKey := env("R2_ACCESS_KEY_ID", "")
	secretKey := env("R2_SECRET_ACCESS_KEY", "")

	if bucket == "" || endpoint == "" || publicBaseURL == "" || accessKey == "" || secretKey == "" {
		return nil, nil
	}

	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion("auto"),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
	)
	if err != nil {
		return nil, fmt.Errorf("load R2 config: %w", err)
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	})

	return &R2Uploader{
		client:        client,
		uploader:      manager.NewUploader(client),
		bucket:        bucket,
		publicBaseURL: publicBaseURL,
	}, nil
}

// Upload stores data in the bucket and returns its public URL. The object key
// is partitioned by month (wa-media/<yyyymm>/<uuid>.<ext>) for tidiness.
func (u *R2Uploader) Upload(ctx context.Context, data []byte, mimeType, ext string) (string, error) {
	if ext == "" {
		ext = "bin"
	}
	now := time.Now()
	key := fmt.Sprintf("wa-media/%s/%s.%s", now.Format("200601"), uuid.NewString(), ext)

	_, err := u.uploader.Upload(ctx, &s3.PutObjectInput{
		Bucket:       aws.String(u.bucket),
		Key:          aws.String(key),
		Body:         bytes.NewReader(data),
		ContentType:  aws.String(mimeType),
		CacheControl: aws.String("private, max-age=2592000"),
	})
	if err != nil {
		return "", fmt.Errorf("upload to R2: %w", err)
	}

	return fmt.Sprintf("%s/%s", u.publicBaseURL, key), nil
}
