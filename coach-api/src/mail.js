const nodemailer = require("nodemailer");

function mailUser() {
  return String(process.env.GMAIL_USER || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

/** Google App Passwords are often copied with spaces — strip them. */
function mailPass() {
  return String(process.env.GMAIL_APP_PASSWORD || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, "");
}

function getTransporter() {
  const user = mailUser();
  const pass = mailPass();
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

function isMailConfigured() {
  return Boolean(mailUser() && mailPass());
}

function mapSmtpError(err) {
  const code = err?.code || "";
  const response = String(err?.response || err?.message || "");
  if (code === "EAUTH" || /Invalid login|Username and Password not accepted/i.test(response)) {
    const e = new Error(
      "Gmail rejected login. On Render, set GMAIL_USER to the notify Gmail and GMAIL_APP_PASSWORD to a 16-character App Password (no spaces). Generate it at Google Account → Security → App passwords.",
    );
    e.code = "MAIL_AUTH_FAILED";
    return e;
  }
  if (code === "EENVELOPE" || /Invalid recipient/i.test(response)) {
    const e = new Error("Invalid recipient email address.");
    e.code = "MAIL_BAD_RECIPIENT";
    return e;
  }
  const e = new Error(err?.message || "Failed to send email via Gmail SMTP");
  e.code = err?.code || "MAIL_SEND_FAILED";
  return e;
}

async function sendProfileVerifyEmail({ to, name, verifyUrl, hostName }) {
  const transporter = getTransporter();
  if (!transporter) {
    const err = new Error("GMAIL_USER / GMAIL_APP_PASSWORD not configured on server");
    err.code = "MAIL_NOT_CONFIGURED";
    throw err;
  }

  const greeter = name || "there";
  const fromLabel = hostName || "a FitTrack user";
  const from = mailUser();
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

  try {
    const info = await transporter.sendMail({
      from: `FitTrack <${from}>`,
      to,
      subject,
      text,
      html,
    });
    console.log("verify email sent", {
      to,
      messageId: info.messageId,
      response: info.response,
    });
    return info;
  } catch (err) {
    console.error("SMTP send failed:", err?.code, err?.response || err?.message);
    throw mapSmtpError(err);
  }
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

module.exports = { sendProfileVerifyEmail, isMailConfigured };
