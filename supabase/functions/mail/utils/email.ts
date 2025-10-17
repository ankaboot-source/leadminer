import nodemailer from 'nodemailer';

const smtpPort = Number(Deno.env.get('SMTP_PORT') ?? 587);

export const transporter = nodemailer.createTransport({
  host: Deno.env.get('SMTP_HOST'),
  port: Number(Deno.env.get('SMTP_PORT') ?? 587),
  secure: smtpPort === 465,// true only if port is 465
  auth: {
    user: Deno.env.get('SMTP_USER'),
    pass: Deno.env.get('SMTP_PASS'),
  },
});
