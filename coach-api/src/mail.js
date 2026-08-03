/**
 * Email for FitTrack verify links.
 *
 * Render FREE tier blocks outbound SMTP (25/465/587) — Nodemailer→Gmail will hang.
 * Prefer HTTPS providers:
 *   RESEND_API_KEY  and/or  SENDGRID_API_KEY
 * SMTP (GMAIL_USER + GMAIL_APP_PASSWORD) only works on paid Render instances.
 */

function mailUser() {
  return String(process.env.GMAIL_USER || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function mailPass() {
  return String(process.env.GMAIL_APP_PASSWORD || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, "");
}

function mailFromAddress() {
  const explicit = String(process.env.MAIL_FROM || "").trim();
  if (explicit) return explicit;
  const user = mailUser();
  if (user) return `FitTrack <${user}>`;
  if (process.env.RESEND_API_KEY) return "FitTrack <onboarding@resend.dev>";
  return "FitTrack <noreply@fittrack.app>";
}

function getMailProvider() {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SENDGRID_API_KEY) return "sendgrid";
  if (mailUser() && mailPass()) return "smtp";
  return "none";
}

function isMailConfigured() {
  return getMailProvider() !== "none";
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function buildBodies({ to, name, verifyUrl, hostName }) {
  const greeter = name || "there";
  const fromLabel = hostName || "a FitTrack user";
  const subject = "Verify your FitTrack profile";
  const text = [
    `Hi ${greeter},`,
    ``,
    `${fromLabel} shared a FitTrack profile with you.`,
    `Open this link to verify your email:`,
    ``,
    verifyUrl,
    ``,
    `Then sign in to FitTrack with Google using ${to}.`,
    ``,
    `If you did not expect this, ignore this email.`,
  ].join("\n");

  const html = `
    <p>Hi <strong>${escapeHtml(greeter)}</strong>,</p>
    <p><strong>${escapeHtml(fromLabel)}</strong> shared a FitTrack profile with you.</p>
    <p><a href="${escapeAttr(verifyUrl)}">Verify your email</a></p>
    <p>Or paste this link:<br/><code>${escapeHtml(verifyUrl)}</code></p>
    <p>Then sign in to FitTrack with Google as <strong>${escapeHtml(to)}</strong>.</p>
  `;

  return { subject, text, html, greeter, fromLabel };
}

async function sendViaResend({ to, subject, text, html }) {
  const key = process.env.RESEND_API_KEY;
  const from = mailFromAddress();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `Resend failed (${res.status})`);
    err.code = "MAIL_PROVIDER_ERROR";
    throw err;
  }
  console.log("verify email sent via resend", { to, id: data.id });
  return data;
}

async function sendViaSendGrid({ to, subject, text, html }) {
  const key = process.env.SENDGRID_API_KEY;
  const fromRaw = mailFromAddress();
  const fromMatch = fromRaw.match(/^(.*?)\s*<([^>]+)>$/);
  const from = fromMatch
    ? { name: fromMatch[1].trim() || "FitTrack", email: fromMatch[2].trim() }
    : { name: "FitTrack", email: fromRaw.replace(/^FitTrack\s*/i, "") || mailUser() };

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from,
      subject,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let message = `SendGrid failed (${res.status})`;
    try {
      const parsed = JSON.parse(body);
      message = parsed?.errors?.[0]?.message || message;
    } catch {
      if (body) message = body.slice(0, 200);
    }
    const err = new Error(message);
    err.code = "MAIL_PROVIDER_ERROR";
    throw err;
  }
  console.log("verify email sent via sendgrid", { to, status: res.status });
  return { ok: true };
}

async function sendViaSmtp({ to, subject, text, html }) {
  const nodemailer = require("nodemailer");
  const user = mailUser();
  const pass = mailPass();
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 15000,
  });

  try {
    const info = await transporter.sendMail({
      from: mailFromAddress(),
      to,
      subject,
      text,
      html,
    });
    console.log("verify email sent via smtp", {
      to,
      messageId: info.messageId,
      response: info.response,
    });
    return info;
  } catch (err) {
    const code = err?.code || "";
    const response = String(err?.response || err?.message || "");
    if (
      code === "ETIMEDOUT" ||
      code === "ESOCKET" ||
      code === "ECONNECTION" ||
      /timeout|unreachable|ENETUNREACH/i.test(response + code)
    ) {
      const e = new Error(
        "Gmail SMTP is blocked on Render free tier. Add RESEND_API_KEY (https://resend.com) or SENDGRID_API_KEY, or upgrade Render to a paid plan.",
      );
      e.code = "MAIL_SMTP_BLOCKED";
      throw e;
    }
    if (code === "EAUTH" || /Invalid login|Username and Password not accepted/i.test(response)) {
      const e = new Error(
        "Gmail rejected login. Check GMAIL_USER / GMAIL_APP_PASSWORD on Render.",
      );
      e.code = "MAIL_AUTH_FAILED";
      throw e;
    }
    const e = new Error(err?.message || "Failed to send email via Gmail SMTP");
    e.code = err?.code || "MAIL_SEND_FAILED";
    throw e;
  }
}

async function sendProfileVerifyEmail({ to, name, verifyUrl, hostName }) {
  const provider = getMailProvider();
  if (provider === "none") {
    const err = new Error(
      "No mail provider configured. On Render set RESEND_API_KEY or SENDGRID_API_KEY (recommended on free tier). Gmail SMTP only works on paid Render.",
    );
    err.code = "MAIL_NOT_CONFIGURED";
    throw err;
  }

  const { subject, text, html } = buildBodies({ to, name, verifyUrl, hostName });
  const payload = { to, subject, text, html };

  if (provider === "resend") return sendViaResend(payload);
  if (provider === "sendgrid") return sendViaSendGrid(payload);
  return sendViaSmtp(payload);
}

module.exports = {
  sendProfileVerifyEmail,
  isMailConfigured,
  getMailProvider,
};
