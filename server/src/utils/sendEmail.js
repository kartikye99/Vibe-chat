const nodemailer = require('nodemailer');

/**
 * Utility to send email via SMTP, with a development console log fallback
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content
 */
const sendEmail = async (options) => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  // Strip whitespace from app password if present (e.g. Google App Password "xxxx xxxx xxxx xxxx")
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : '';

  // If SMTP is not fully configured, fall back to console logging
  if (!host || !user || !pass) {
    console.log('\n==================================================');
    console.log(`✉️  DEV FALLBACK: EMAIL TO: ${options.email}`);
    console.log(`📝 SUBJECT: ${options.subject}`);
    console.log(`🔑 ${options.text}`);
    console.log('==================================================\n');
    return { success: true, fallback: true };
  }

  // Use nodemailer transport options
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
    console.log(`Email sent successfully to ${options.email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Nodemailer send email error:', error.message || error);
    // Dev fallback output so developers can still see code during local dev
    console.log('\n==================================================');
    console.log(`✉️  DEV FALLBACK (SMTP FAILED): EMAIL TO: ${options.email}`);
    console.log(`🔑 ${options.text}`);
    console.log('==================================================\n');
    return { success: false, error: error.message || 'Failed to send email' };
  }
};

module.exports = sendEmail;
