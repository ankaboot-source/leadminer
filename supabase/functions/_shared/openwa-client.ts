export interface OpenWASession {
  id: string;
  name: string;
  status: string;
}

export interface OpenWAQrCode {
  qr: string;
}

export interface OpenWASendResult {
  messageId: string;
  status: string;
}

export interface OpenWAWebhookConfig {
  url: string;
  events: string[];
  secret: string;
}

export class OpenWAClient {
  constructor(
    private baseUrl: string,
    private apiKey?: string,
  ) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) h["X-API-Key"] = this.apiKey;
    return h;
  }

  async createSession(name: string): Promise<OpenWASession> {
    const res = await fetch(`${this.baseUrl}/api/sessions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok)
      throw new Error(
        `OpenWA createSession failed: ${res.status} ${await res.text()}`,
      );
    return res.json();
  }

  async startSession(sessionId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/start`, {
      method: "POST",
      headers: this.headers(),
    });
    if (!res.ok)
      throw new Error(
        `OpenWA startSession failed: ${res.status} ${await res.text()}`,
      );
  }

  async getQrCode(sessionId: string): Promise<OpenWAQrCode> {
    const res = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/qr`, {
      headers: this.headers(),
    });
    if (!res.ok)
      throw new Error(`OpenWA getQr failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async getSessionStatus(sessionId: string): Promise<{ status: string }> {
    const res = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`, {
      headers: this.headers(),
    });
    if (!res.ok)
      throw new Error(
        `OpenWA getSessionStatus failed: ${res.status} ${await res.text()}`,
      );
    return res.json();
  }

  async deleteSession(sessionId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok)
      throw new Error(
        `OpenWA deleteSession failed: ${res.status} ${await res.text()}`,
      );
  }

  async sendText(
    sessionId: string,
    chatId: string,
    text: string,
  ): Promise<OpenWASendResult> {
    const res = await fetch(
      `${this.baseUrl}/api/sessions/${sessionId}/messages/send-text`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ chatId, text }),
      },
    );
    if (!res.ok)
      throw new Error(
        `OpenWA sendText failed: ${res.status} ${await res.text()}`,
      );
    return res.json();
  }

  async setupWebhook(
    sessionId: string,
    config: OpenWAWebhookConfig,
  ): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/api/sessions/${sessionId}/webhooks`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(config),
      },
    );
    if (!res.ok)
      throw new Error(
        `OpenWA setupWebhook failed: ${res.status} ${await res.text()}`,
      );
  }
}
