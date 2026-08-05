const nodemailer = require('nodemailer');

/**
 * Utility to send email via Resend HTTP API (production) or SMTP/nodemailer (local dev).
 * Resend is preferred for cloud deployments (Render, Vercel, etc.) because many
 * cloud platforms block outbound SMTP connections on ports 587/465.
 *
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content
 */

// ─── Resend HTTP API transport (works on all cloud platforms) ───
const sendViaResend = async (options) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'VibeChat <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [options.email],
        subject: options.subject,
        text: options.text,
        html: options.html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      return { success: false, error: data.message || `Resend HTTP ${res.status}` };
    }

    console.log(`Email sent via Resend to ${options.email}: ${data.id}`);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Resend fetch error:', error.message || error);
    return { success: false, error: error.message || 'Resend request failed' };
  }
};

// ─── Nodemailer SMTP transport (works locally / on servers with SMTP access) ───
const sendViaSMTP = async (options) => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  // Strip whitespace from app password if present (e.g. Google App Password "xxxx xxxx xxxx xxxx")
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : '';

  const transportConfig = (host === 'smtp.gmail.com' || process.env.SMTP_SERVICE === 'gmail')
    ? {
        service: 'gmail',
        auth: { user, pass },
      }
    : {
        host: host,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true' || parseInt(process.env.SMTP_PORT || '587') === 465,
        auth: { user, pass },
      };

  const transporter = nodemailer.createTransport(transportConfig);

  const mailOptions = {
    from: process.env.SMTP_FROM || `"VibeChat" <${user}>`,
    to: options.email,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent via SMTP to ${options.email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Nodemailer SMTP error:', error.message || error);
    return { success: false, error: error.message || 'SMTP send failed' };
  }
};

// ─── Main sendEmail function ───
const sendEmail = async (options) => {
  // 1. Resend HTTP API (recommended for cloud / Render)
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(options);
  }

  // 2. SMTP via nodemailer (recommended for local dev)
  const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
  if (smtpConfigured) {
    return sendViaSMTP(options);
  }

  // 3. Dev fallback — log OTP to console
  console.log('\n==================================================');
  console.log(`✉️  DEV FALLBACK: EMAIL TO: ${options.email}`);
  console.log(`📝 SUBJECT: ${options.subject}`);
  console.log(`🔑 ${options.text}`);
  console.log('==================================================\n');
  return { success: true, fallback: true };
};

module.exports = sendEmail;
