import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import initializeSmtpSendersController from '../../../src/controllers/smtp-senders.controller';
import {
  SmtpSender,
  SmtpSenders
} from '../../../src/db/interfaces/SmtpSenders';

// Mock the Provider module
jest.mock('../../../src/services/auth/Provider', () => ({
  getProviderFromEmail: jest.fn()
}));

// Mock the logger module
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('SmtpSendersController', () => {
  const mockSmtpSenders: jest.Mocked<SmtpSenders> = {
    getByUser: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteByMiningSourceId: jest.fn(),
    getPassword: jest.fn()
  };

  const mockReq = {} as Request;
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    locals: { user: { id: 'user-1' } }
  } as unknown as Response;
  const mockNext = jest.fn() as NextFunction;

  let controller: ReturnType<typeof initializeSmtpSendersController>;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = initializeSmtpSendersController(mockSmtpSenders);
  });

  describe('listSenders', () => {
    it('returns senders for user', async () => {
      const senders: SmtpSender[] = [
        {
          id: '1',
          email: 'a@b.com',
          userId: 'user-1',
          name: 'Test',
          smtpHost: 'smtp.b.com',
          smtpPort: 587,
          smtpEncryption: 'starttls',
          smtpUser: 'a@b.com',
          authType: 'password',
          active: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01'
        }
      ];
      mockSmtpSenders.getByUser.mockResolvedValue(senders);

      await controller.listSenders(mockReq, mockRes, mockNext);

      expect(mockSmtpSenders.getByUser).toHaveBeenCalledWith('user-1');
      expect(mockRes.json).toHaveBeenCalledWith({ senders });
    });
  });

  describe('createSender', () => {
    it('creates sender with valid data', async () => {
      const senderData = {
        name: 'Work',
        email: 'user@co.com',
        smtpHost: 'smtp.co.com',
        smtpPort: 587,
        smtpEncryption: 'starttls',
        smtpUser: 'user@co.com',
        smtpPassword: 'secret'
      };
      mockReq.body = senderData;
      mockSmtpSenders.create.mockResolvedValue({
        id: '1',
        ...senderData,
        authType: 'password' as const,
        active: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      });

      await controller.createSender(mockReq, mockRes, mockNext);

      expect(mockSmtpSenders.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', ...senderData })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('deleteSender', () => {
    it('deletes sender and returns success', async () => {
      mockReq.params = { id: 'uuid-1' };
      mockSmtpSenders.delete.mockResolvedValue(true);

      await controller.deleteSender(mockReq, mockRes, mockNext);

      expect(mockSmtpSenders.delete).toHaveBeenCalledWith('uuid-1', 'user-1');
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });
  });
});
