import nodemailer from "nodemailer";

const host = Deno.env.get("SMTP_HOST");
const port = Number(Deno.env.get("SMTP_PORT") ?? 587);
const user = Deno.env.get("SMTP_USER");
const pass = Deno.env.get("SMTP_PASS");
const from = `"leadminer" <${user}>`;

export async function sendEmail(to: string, subject: string, html: string) {
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
  });

  console.log("Email sent:", info.messageId);
}
