const nodemailer = require("nodemailer");

module.exports = async (req, res) => {
  // CORS configuration
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Health check endpoint
  if (req.method === "GET") {
    return res.status(200).json({ status: "ok", service: "Civic Email Relay Service" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { to, subject, text, html } = req.body || {};

  if (!to || !subject) {
    return res.status(400).json({ error: "Missing required fields: to, subject" });
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER || "smartcivicissuereportingsystem@gmail.com",
      pass: process.env.EMAIL_PASS || "exkm tmea ghdu fcdm",
    },
    connectionTimeout: 8000,
    socketTimeout: 8000,
  });

  try {
    const info = await transporter.sendMail({
      from: '"Smart Civic Reporting System" <smartcivicissuereportingsystem@gmail.com>',
      to,
      subject,
      text: text || "",
      html: html || undefined,
    });

    console.log(`[EMAIL SUCCESS] Sent to: ${to} | MessageId: ${info.messageId}`);
    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error("[EMAIL ERROR] Sending failed:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
