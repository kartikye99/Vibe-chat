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
  // If SMTP is not fully configured, fall back to console logging
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    console.log('\n==================================================');
    console.log(`✉️  DEV FALLBACK: EMAIL TO: ${options.email}`);
    console.log(`📝 SUBJECT: ${options.subject}`);
    console.log(`🔑 ${options.text}`);
    console.log('==================================================\n');
    return true;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true' || parseInt(process.env.SMTP_PORT || '587') === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || `"VibeChat" <noreply@vibechat.com>`,
    to: options.email,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Nodemailer send email error:', error);
    // Even if it fails, fallback to console log so development is not blocked
    console.log('\n==================================================');
    console.log(`✉️  DEV FALLBACK (SMTP FAILED): EMAIL TO: ${options.email}`);
    console.log(`🔑 ${options.text}`);
    console.log('==================================================\n');
    return false;
  }
};

module.exports = sendEmail;
