import { config } from '../config';

class WaConnectorClient {
  private get baseUrl() {
    return config.waConnectorUrl.replace(/\/+$/, '');
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      'X-Internal-Token': config.waConnectorToken,
    };
  }

  async createSession(deviceId: string): Promise<{ qr: string | null }> {
    try {
      const res = await fetch(`${this.baseUrl}/internal/wa/device/${deviceId}/session`, {
        method: 'POST',
        headers: this.headers(),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to create session: ${res.status} ${text}`);
      }
      return (await res.json()) as { qr: string | null };
    } catch (err: any) {
      console.error(`[WaClient] createSession error:`, err.message);
      return { qr: null };
    }
  }

  async getQr(deviceId: string): Promise<{ qr: string | null; status: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/internal/wa/device/${deviceId}/qr`, {
        headers: this.headers(),
      });
      if (!res.ok) {
        return { qr: null, status: 'disconnected' };
      }
      return (await res.json()) as { qr: string | null; status: string };
    } catch (err: any) {
      console.error(`[WaClient] getQr error:`, err.message);
      return { qr: null, status: 'disconnected' };
    }
  }

  async getStatus(deviceId: string): Promise<{ status: string; phoneNumber?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/internal/wa/device/${deviceId}/status`, {
        headers: this.headers(),
      });
      if (!res.ok) {
        return { status: 'disconnected' };
      }
      return (await res.json()) as { status: string; phoneNumber?: string };
    } catch (err: any) {
      console.error(`[WaClient] getStatus error:`, err.message);
      return { status: 'disconnected' };
    }
  }

  async deleteSession(deviceId: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/internal/wa/device/${deviceId}/session`, {
        method: 'DELETE',
        headers: this.headers(),
      });
      return res.ok;
    } catch (err: any) {
      console.error(`[WaClient] deleteSession error:`, err.message);
      return false;
    }
  }

  async sendMessage(payload: {
    deviceId: string;
    to: string;
    type: 'text' | 'image' | 'document';
    message?: string | null;
    mediaUrl?: string | null;
    caption?: string | null;
  }): Promise<{ messageId: string }> {
    const res = await fetch(`${this.baseUrl}/internal/wa/send`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`WA Connector error (${res.status}): ${err}`);
    }
    return (await res.json()) as { messageId: string };
  }

  async getGroups(deviceId: string): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/internal/wa/groups?deviceId=${encodeURIComponent(deviceId)}`, {
      headers: this.headers(),
    });
    if (!res.ok) return [];
    return (await res.json()) as any[];
  }

  async getGroupMembers(deviceId: string, groupId: string): Promise<any[]> {
    const res = await fetch(
      `${this.baseUrl}/internal/wa/group/members?deviceId=${encodeURIComponent(deviceId)}&groupId=${encodeURIComponent(groupId)}`,
      { headers: this.headers() },
    );
    if (!res.ok) return [];
    return (await res.json()) as any[];
  }
}

export const waClient = new WaConnectorClient();
