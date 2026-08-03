const nodemailer = require("nodemailer");

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

function isMailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
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
  const from = process.env.GMAIL_USER;
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

  await transporter.sendMail({
    from: `FitTrack <${from}>`,
    to,
    subject,
    text,
    html,
  });
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
