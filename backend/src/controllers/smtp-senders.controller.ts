import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { SmtpSenders } from '../db/interfaces/SmtpSenders';
import { getProviderFromEmail } from '../services/auth/Provider';

export default function initializeSmtpSendersController(
  smtpSenders: SmtpSenders
) {
  return {
    async listSenders(req: Request, res: Response, next: NextFunction) {
      try {
        const user = res.locals.user as User;
        const senders = await smtpSenders.getByUser(user.id);
        return res.json({ senders });
      } catch (error) {
        return next(error);
      }
    },

    async getSender(req: Request, res: Response, next: NextFunction) {
      try {
        const user = res.locals.user as User;
        const sender = await smtpSenders.getById(req.params.id, user.id);
        if (!sender) {
          res.status(404);
          return next(new Error('Sender not found'));
        }
        return res.json({ sender });
      } catch (error) {
        return next(error);
      }
    },

    async createSender(req: Request, res: Response, next: NextFunction) {
      try {
        const user = res.locals.user as User;
        const {
          name,
          email,
          smtpHost,
          smtpPort,
          smtpEncryption,
          smtpUser,
          smtpPassword
        } = req.body;

        if (
          !name ||
          !email ||
          !smtpHost ||
          !smtpPort ||
          !smtpUser ||
          !smtpPassword
        ) {
          res.status(400);
          return next(new Error('Missing required fields'));
        }

        const sender = await smtpSenders.create({
          userId: user.id,
          name,
          email,
          smtpHost,
          smtpPort: Number(smtpPort),
          smtpEncryption: smtpEncryption ?? 'starttls',
          smtpUser,
          smtpPassword
        });

        return res.status(201).json({ sender });
      } catch (error) {
        return next(error);
      }
    },

    async updateSender(req: Request, res: Response, next: NextFunction) {
      try {
        const user = res.locals.user as User;
        const {
          name,
          smtpHost,
          smtpPort,
          smtpEncryption,
          smtpUser,
          smtpPassword,
          active
        } = req.body;

        const sender = await smtpSenders.update(req.params.id, user.id, {
          name,
          smtpHost,
          smtpPort: smtpPort ? Number(smtpPort) : undefined,
          smtpEncryption,
          smtpUser,
          smtpPassword,
          active
        });

        if (!sender) {
          res.status(404);
          return next(new Error('Sender not found'));
        }

        return res.json({ sender });
      } catch (error) {
        return next(error);
      }
    },

    async deleteSender(req: Request, res: Response, next: NextFunction) {
      try {
        const user = res.locals.user as User;
        const deleted = await smtpSenders.delete(req.params.id, user.id);
        if (!deleted) {
          res.status(404);
          return next(new Error('Sender not found'));
        }
        return res.json({ success: true });
      } catch (error) {
        return next(error);
      }
    },

    async testSender(req: Request, res: Response, next: NextFunction) {
      try {
        const user = res.locals.user as User;
        const sender = await smtpSenders.getById(req.params.id, user.id);
        if (!sender) {
          res.status(404);
          return next(new Error('Sender not found'));
        }

        const password = await smtpSenders.getPassword(req.params.id, user.id);
        const { to } = req.body;
        const testTo = to || user.email;

        const transport = nodemailer.createTransport({
          host: sender.smtpHost,
          port: sender.smtpPort,
          secure: sender.smtpEncryption === 'ssl',
          requireTLS: sender.smtpEncryption === 'starttls',
          auth: {
            user: sender.smtpUser,
            pass: password ?? ''
          }
        });

        try {
          await transport.sendMail({
            from: `"${sender.name}" <${sender.email}>`,
            to: testTo,
            subject: 'Leadminer SMTP Test',
            text: 'This is a test email from Leadminer to verify your SMTP configuration.'
          });

          return res.json({ success: true, message: 'Test email sent' });
        } finally {
          transport.close();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Test failed';
        return res.status(400).json({ success: false, message });
      }
    },

    autodetect(req: Request, res: Response, next: NextFunction) {
      try {
        const { email } = req.body;
        if (!email) {
          res.status(400);
          return next(new Error('Email is required'));
        }

        const provider = getProviderFromEmail(email);
        if (provider) {
          return res.json({
            smtpHost:
              provider === 'google'
                ? 'smtp.gmail.com'
                : 'smtp-mail.outlook.com',
            smtpPort: 587,
            smtpEncryption: 'starttls',
            authType: 'oauth',
            oauthProvider: provider === 'google' ? 'google' : 'azure'
          });
        }

        const domain = email.split('@')[1]?.toLowerCase();
        if (!domain) {
          return res.json(null);
        }

        return res.json({
          smtpHost: `smtp.${domain}`,
          smtpPort: 587,
          smtpEncryption: 'starttls',
          authType: 'password'
        });
      } catch (error) {
        return next(error);
      }
    }
  };
}
