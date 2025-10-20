import nodemailer from "nodemailer";

const host = Deno.env.get("SMTP_HOST");
const port = Deno.env.get("SMTP_PORT");
const user = Deno.env.get("SMTP_USER");
const pass = Deno.env.get("SMTP_PASS");
const from = `"leadminer" <${user}>`;

export async function sendEmail(to: string, subject: string, html: string) {
  const transporter = nodemailer.createTransport({
    host,
    port,
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

  console.log("Email sent:", info.envolope);
}
