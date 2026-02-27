import nodemailer from "nodemailer";
import {
  inlineDataImagesAsCid,
  type InlineImageAttachment,
} from "../_shared/inline-images.ts";

const host = Deno.env.get("SMTP_HOST");
const port = Deno.env.get("SMTP_PORT");
const user = Deno.env.get("SMTP_USER");
const pass = Deno.env.get("SMTP_PASS");
const defaultFrom = `"leadminer" <${user}>`;

type SendEmailOptions = {
  from?: string;
  replyTo?: string;
  text?: string;
  attachments?: InlineImageAttachment[];
  transport?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass?: string;
      type?: "OAuth2";
      accessToken?: string;
    };
  };
};

function getDefaultTransport() {
  return {
    host,
    port,
    secure: Number(port) === 465,
    auth: {
      user,
      pass,
    },
  };
}

export async function verifyTransport(
  transport?: SendEmailOptions["transport"],
) {
  const transporter = nodemailer.createTransport(
    transport ?? getDefaultTransport(),
  );
  await transporter.verify();
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  options: SendEmailOptions = {},
) {
  const transporter = nodemailer.createTransport(
    options.transport ?? getDefaultTransport(),
  );
  const inlinePayload = inlineDataImagesAsCid(html);
  const attachments = [
    ...(options.attachments ?? []),
    ...inlinePayload.attachments,
  ];

  const info = await transporter.sendMail({
    from: options.from ?? defaultFrom,
    to,
    subject,
    html: inlinePayload.html,
    text: options.text,
    replyTo: options.replyTo,
    attachments,
  });

  console.log("Email sent:", { to, messageId: info.messageId });
  // console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info)); // For local testing only
}
