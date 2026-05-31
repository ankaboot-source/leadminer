/* eslint-disable class-methods-use-this */
import axios from 'axios';
import logger from '../utils/logger';

export interface OpenWASession {
  id: string;
  sessionName: string;
  status: 'CREATED' | 'QR_READY' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  qrCode?: string;
  connectedPhone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpenWAMessage {
  to: string;
  body: string;
  type?: 'text' | 'image' | 'document' | 'video';
  url?: string;
  caption?: string;
}

export interface OpenWAWebhookPayload {
  event: 'message' | 'message.ack' | 'message.read' | 'qr' | 'disconnected';
  data: Record<string, unknown>;
  session: string;
}

export class OpenWAClient {
  private readonly apiUrl: string;

  private readonly apiKey: string;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  private client() {
    return axios.create({
      baseURL: this.apiUrl,
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  async createSession(sessionName: string): Promise<OpenWASession> {
    logger.info(`Creating OpenWA session: ${sessionName}`);
    const response = await this.client().post('/api/session/start', {
      name: sessionName
    });
    return response.data as OpenWASession;
  }

  async getSession(sessionName: string): Promise<OpenWASession> {
    logger.info(`Getting OpenWA session: ${sessionName}`);
    const response = await this.client().get(`/api/session/${sessionName}`);
    return response.data as OpenWASession;
  }

  async listSessions(): Promise<OpenWASession[]> {
    logger.info('Listing all OpenWA sessions');
    const response = await this.client().get('/api/sessions');
    return response.data as OpenWASession[];
  }

  async terminateSession(sessionName: string): Promise<void> {
    logger.info(`Terminating OpenWA session: ${sessionName}`);
    await this.client().delete(`/api/session/${sessionName}`);
  }

  async sendMessage(
    sessionName: string,
    message: OpenWAMessage
  ): Promise<{ id: string; status: string }> {
    logger.info(
      `Sending WhatsApp message via session ${sessionName} to ${message.to}`
    );
    const response = await this.client().post(`/api/sendText`, {
      session: sessionName,
      to: message.to,
      body: message.body,
      isGroup: false
    });
    return response.data as { id: string; status: string };
  }

  async sendMediaMessage(
    sessionName: string,
    message: OpenWAMessage
  ): Promise<{ id: string; status: string }> {
    logger.info(
      `Sending WhatsApp media via session ${sessionName} to ${message.to}`
    );

    if (!message.url) {
      throw new Error('URL is required for media messages');
    }

    const type = message.type || 'image';
    const endpoint = this.getMediaEndpoint(type);

    const response = await this.client().post(endpoint, {
      session: sessionName,
      to: message.to,
      url: message.url,
      caption: message.caption || message.body,
      isGroup: false
    });

    return response.data as { id: string; status: string };
  }

  private getMediaEndpoint(type: string): string {
    switch (type) {
      case 'image':
        return '/api/sendImage';
      case 'document':
        return '/api/sendFile';
      case 'video':
        return '/api/sendVideo';
      default:
        throw new Error(`Unsupported media type: ${type}`);
    }
  }

  async verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): Promise<boolean> {
    const crypto = await import('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return signature === expectedSignature;
  }
}

export default OpenWAClient;
