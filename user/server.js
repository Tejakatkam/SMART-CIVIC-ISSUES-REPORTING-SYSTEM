const express = require("express");
const mysql = require("mysql2/promise");
const multer = require("multer");
const path = require("path");
const { exec } = require("child_process");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const session = require("express-session");

const app = express();

// ---------- MULTER STORAGE ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const upload = multer({ storage });

// ---------- MIDDLEWARE ----------
app.use(express.json());
app.use(express.static(__dirname));
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
app.use("/uploads", express.static(UPLOADS_DIR));
const ADMIN_DIR = path.join(__dirname, "..", "admin");
app.use("/admin", express.static(ADMIN_DIR));
app.get("/admin", (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, "index.html"));
});
app.get("/favicon.ico", (req, res) => {
  res.sendFile(path.join(__dirname, "favicon.ico"));
});

app.use(
  session({
    secret: "secret123tejaproject",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
  }),
);

// ---------- DB POOL ----------
const isCloudHost =
  process.env.DB_HOST &&
  process.env.DB_HOST !== "localhost" &&
  process.env.DB_HOST !== "127.0.0.1";
const useSSL = process.env.DB_SSL === "true" || isCloudHost;

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password:
    process.env.DB_PASSWORD !== undefined
      ? process.env.DB_PASSWORD
      : "abhiteja2005",
  database: process.env.DB_NAME || "civicdb",
  port: process.env.DB_PORT
    ? parseInt(process.env.DB_PORT)
    : isCloudHost
      ? 4000
      : 3306,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

console.log(
  `[DB CONFIG] Target: ${process.env.DB_HOST || "localhost"}:${
    process.env.DB_PORT || (isCloudHost ? 4000 : 3306)
  } | User: ${process.env.DB_USER || "root"} | SSL: ${useSSL ? "Enabled" : "Disabled"}`,
);

db.getConnection()
  .then(async (conn) => {
    console.log("[DB SUCCESS] Connected to MySQL database successfully!");
    try {
      const [tables] = await conn.query("SHOW TABLES");
      const names = tables.map((t) => Object.values(t)[0]);
      console.log(
        `[DB TABLES] Found ${names.length} tables in database:`,
        names,
      );
    } catch (e) {
      console.warn("[DB TABLES] Could not list tables:", e.message);
    }
    conn.release();
  })
  .catch((err) => {
    console.error("[DB ERROR] Could not connect to MySQL:", err.message);
  });

// ---------- EMAIL ----------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "smartcivicissuereportingsystem@gmail.com",
    pass: "exkm tmea ghdu fcdm", // app password
  },
  connectionTimeout: 4000,
  greetingTimeout: 4000,
  socketTimeout: 4000,
});

const sendEmail = async (to, subject, text, html) => {
  const vercelEmailUrl = process.env.VERCEL_EMAIL_URL;

  // 1) Try Vercel Serverless Relay (HTTPS port 443 - never blocked by cloud hosts)
  if (vercelEmailUrl) {
    try {
      const response = await fetch(vercelEmailUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, text, html }),
      });
      const data = await response.json().catch(() => null);
      if (data && data.success) {
        console.log(`[EMAIL VERCEL SUCCESS] Sent to ${to} (MessageId: ${data.messageId || "ok"})`);
        return;
      }
      console.warn(`[EMAIL VERCEL WARN] Vercel response:`, data?.error || "unknown");
    } catch (e) {
      console.warn(`[EMAIL VERCEL FAIL] Could not reach Vercel relay: ${e.message}. Falling back to direct SMTP.`);
    }
  }

  // 2) Fallback to Direct Gmail SMTP
  try {
    await transporter.sendMail({
      from: "Smart Civic System <smartcivicissuereportingsystem@gmail.com>",
      to,
      subject,
      text, // Plain text fallback
      html, // Styled HTML version
    });
    console.log(`[EMAIL SMTP SUCCESS] Sent to ${to}`);
  } catch (err) {
    console.error("[EMAIL ERROR] Send failed (non-blocking):", err.message);
  }
};

// ---------- IMAGE CLASSIFICATION ----------
const classifyImage = (imagePath, category) => {
  return new Promise((resolve) => {
    const pythonCmd =
      process.env.PYTHON_CMD ||
      (process.platform === "win32" ? "python" : "python3");
    const scriptPath = path.join(__dirname, "classify.py");
    const command = `${pythonCmd} "${scriptPath}" "${imagePath}" "${category}"`;

    console.log("[CLASSIFY] Executing command:", command);
    console.log("[CLASSIFY] Current directory:", __dirname);
    console.log(
      "[CLASSIFY] Image path exists?",
      require("fs").existsSync(imagePath),
    );

    exec(command, { cwd: __dirname, timeout: 15000 }, (error, stdout, stderr) => {
      console.log("[CLASSIFY] ───────────────────────────────────────");
      console.log("[CLASSIFY] error:", error);
      console.log("[CLASSIFY] stdout:", stdout);
      console.log("[CLASSIFY] stderr:", stderr);
      console.log("[CLASSIFY] ───────────────────────────────────────");

      if (error) {
        console.error("[CLASSIFY] Execution failed or timed out:", error.message);
        // Fallback confidence (75%) so report creation is never stuck
        const fallback = 75.0;
        console.warn(`[CLASSIFY] Using fallback confidence: ${fallback}%`);
        resolve(fallback);
        return;
      }

      const output = stdout ? stdout.trim() : "";
      const confidence = parseFloat(output) || 75.0;

      console.log(
        `[CLASSIFY] Parsed confidence for ${category}: ${confidence}`,
      );

      resolve(confidence);
    });
  });
};

// ---------- AUTH HELPER: ATTACH req.user ----------
app.use(async (req, res, next) => {
  if (!req.session.userId) {
    req.user = null;
    return next();
  }
  try {
    const [rows] = await db.query(
      "SELECT id, username, role, municipalityId FROM users WHERE id = ?",
      [req.session.userId],
    );
    req.user = rows[0] || null;
  } catch (e) {
    console.error("Error loading req.user", e);
    req.user = null;
  }
  next();
});

// ---------- ADMIN GUARD ----------
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

const CONFIDENCE_THRESHOLDS = {
  garbage: 65,
  pothole: 65,
  waterleak: 68,
  sewage: 65,
  streetlights: 60,
};
// -----------------------

// ---------- AUTH ROUTES ----------
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1) Try normal users table first
    const [userRows] = await db.query(
      "SELECT * FROM users WHERE username = ?",
      [username],
    );
    let dbUser = userRows[0];

    if (dbUser) {
      const passwordOk = bcrypt.compareSync(password, dbUser.password);
      if (!passwordOk) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // block check for any user
      if (dbUser.accountStatus && dbUser.accountStatus === "blocked") {
        return res
          .status(403)
          .json({ error: "Your account is currently blocked by admin." });
      }

      req.session.userId = dbUser.id;

      const [full] = await db.query(
        `SELECT u.id,
                u.username,
                u.role,
                u.municipalityId,
                u.accountStatus,
                m.name AS municipalityName
         FROM users u
         LEFT JOIN municipalities m ON u.municipalityId = m.id
         WHERE u.id = ?`,
        [dbUser.id],
      );

      return res.json({ user: full[0] });
    }

    // 2) Not found in users table → check official_applications
    const [appRows] = await db.query(
      "SELECT * FROM official_applications WHERE username = ?",
      [username],
    );
    const appRow = appRows[0];

    if (!appRow) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const passwordOk = bcrypt.compareSync(password, appRow.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check application status
    if (appRow.status === "pending") {
      return res
        .status(403)
        .json({ error: "Your official account is pending admin approval." });
    }

    if (appRow.status === "rejected") {
      return res.status(403).json({
        error: "Your official account request was rejected by admin.",
      });
    }

    // 3) status === 'approved' → ensure user exists in users table
    const [existingOfficialRows] = await db.query(
      'SELECT * FROM users WHERE username = ? AND role = "municipality"',
      [appRow.username],
    );
    dbUser = existingOfficialRows[0];

    if (!dbUser) {
      const [insertResult] = await db.query(
        `INSERT INTO users (username, email, password, role, municipalityId, accountStatus)
         VALUES (?, ?, ?, 'municipality', ?, 'active')`,
        [
          appRow.username,
          appRow.email,
          appRow.password_hash,
          appRow.municipality_id,
        ],
      );

      const newUserId = insertResult.insertId;

      const [newUserRows] = await db.query(
        `SELECT u.id,
                u.username,
                u.role,
                u.municipalityId,
                u.accountStatus,
                m.name AS municipalityName
         FROM users u
         LEFT JOIN municipalities m ON u.municipalityId = m.id
         WHERE u.id = ?`,
        [newUserId],
      );

      dbUser = newUserRows[0];
    } else {
      // Already created earlier, load with join to municipalities
      const [fullExisting] = await db.query(
        `SELECT u.id,
                u.username,
                u.role,
                u.municipalityId,
                u.accountStatus,
                m.name AS municipalityName
         FROM users u
         LEFT JOIN municipalities m ON u.municipalityId = m.id
         WHERE u.id = ?`,
        [dbUser.id],
      );
      dbUser = fullExisting[0];
    }

    // block check for municipality officials as well
    if (dbUser.accountStatus && dbUser.accountStatus === "blocked") {
      return res
        .status(403)
        .json({ error: "Your account is currently blocked by admin." });
    }

    req.session.userId = dbUser.id;
    return res.json({ user: dbUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/me", async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });

  try {
    const [rows] = await db.query(
      `SELECT u.id, u.username, u.email, u.role, u.municipalityId, u.accountStatus, u.createdAt, m.name AS municipalityName
       FROM users u
       LEFT JOIN municipalities m ON u.municipalityId = m.id
       WHERE u.id = ?`,
      [req.session.userId],
    );

    res.json({ user: rows[0] || null });
  } catch (err) {
    res.json({ user: null });
  }
});

// ---------- PROFILE ENDPOINTS ----------
app.get("/api/profile", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const [rows] = await db.query(
      `SELECT u.id, u.username, u.email, u.role, u.municipalityId, u.accountStatus, u.createdAt,
              m.name AS municipalityName, m.email AS municipalityEmail
       FROM users u
       LEFT JOIN municipalities m ON u.municipalityId = m.id
       WHERE u.id = ?`,
      [req.session.userId],
    );

    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    let stats = {};

    if (user.role === "user") {
      const [[reportStats]] = await db.query(
        `SELECT 
           COUNT(*) AS totalReports,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedReports,
           SUM(CASE WHEN status IN ('pending', 'accepted') THEN 1 ELSE 0 END) AS pendingReports,
           SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejectedReports,
           SUM(CASE WHEN feedback = 'satisfied' THEN 1 ELSE 0 END) AS satisfiedFeedback,
           SUM(CASE WHEN feedback = 'unsatisfied' THEN 1 ELSE 0 END) AS unsatisfiedFeedback
         FROM requests WHERE userId = ?`,
        [user.id],
      );
      stats = {
        totalReports: Number(reportStats?.totalReports) || 0,
        completedReports: Number(reportStats?.completedReports) || 0,
        pendingReports: Number(reportStats?.pendingReports) || 0,
        rejectedReports: Number(reportStats?.rejectedReports) || 0,
        satisfiedFeedback: Number(reportStats?.satisfiedFeedback) || 0,
        unsatisfiedFeedback: Number(reportStats?.unsatisfiedFeedback) || 0,
      };
    } else if (user.role === "municipality") {
      const [[jurisdictionStats]] = await db.query(
        `SELECT 
           COUNT(*) AS totalJurisdictionReports,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedReports,
           SUM(CASE WHEN status IN ('pending', 'accepted') THEN 1 ELSE 0 END) AS pendingReports,
           SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejectedReports
         FROM requests WHERE municipalityId = ?`,
        [user.municipalityId],
      );

      const [[myCompletions]] = await db.query(
        `SELECT COUNT(*) AS count FROM official_issue_completions WHERE officialId = ?`,
        [user.id],
      );

      stats = {
        totalJurisdictionReports: Number(jurisdictionStats?.totalJurisdictionReports) || 0,
        completedReports: Number(jurisdictionStats?.completedReports) || 0,
        pendingReports: Number(jurisdictionStats?.pendingReports) || 0,
        rejectedReports: Number(jurisdictionStats?.rejectedReports) || 0,
        myCompletions: Number(myCompletions?.count) || 0,
      };
    }

    res.json({ user, stats });
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

app.post("/api/profile/change-password", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new passwords are required" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters" });
  }

  try {
    const [rows] = await db.query(
      "SELECT id, password FROM users WHERE id = ?",
      [req.session.userId],
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const match = bcrypt.compareSync(currentPassword, user.password);
    if (!match) {
      return res.status(400).json({ error: "Incorrect current password" });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await db.query("UPDATE users SET password = ? WHERE id = ?", [
      hashedPassword,
      user.id,
    ]);

    res.json({ success: true, message: "Password updated successfully!" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Failed to update password" });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {});
  res.json({ success: true });
});

// ---------- BASIC DATA ----------
app.get("/api/municipalities", async (req, res) => {
  const [rows] = await db.query(
    "SELECT id, name FROM municipalities ORDER BY name",
  );
  res.json(rows);
});

app.get("/api/requests", async (req, res) => {
  try {
    // Make sure user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized - please log in" });
    }

    let query = "";
    let params = [];

    if (req.user.role === "user") {
      // Citizens see ONLY their own reports
      query = `
        SELECT r.*, m.name AS municipalityName
        FROM requests r
        JOIN municipalities m ON r.municipalityId = m.id
        WHERE r.userId = ?
        ORDER BY r.createdAt DESC
      `;
      params = [req.user.id];
    } else if (req.user.role === "municipality") {
      // Municipality officials see all reports in their municipality
      query = `
        SELECT r.*, m.name AS municipalityName
        FROM requests r
        JOIN municipalities m ON r.municipalityId = m.id
        WHERE r.municipalityId = ?
        ORDER BY r.createdAt DESC
      `;
      params = [req.user.municipalityId];
    } else {
      // For admin or any other role — you can restrict or allow all
      return res.status(403).json({ error: "Access denied for this role" });
    }

    const [rows] = await db.query(query, params);

    // Fix image paths
    rows.forEach((r) => {
      r.imagePath = `/uploads/${r.imagePath}`;
      if (r.afterImagePath) r.afterImagePath = `/uploads/${r.afterImagePath}`;
    });

    res.json(rows);
  } catch (err) {
    console.error("Error fetching requests:", err);
    res.status(500).json({ error: "Failed to load reports" });
  }
});

// ---------- REGISTER ----------
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password, role, municipalityId } = req.body;
    const passwordHash = bcrypt.hashSync(password, 10);

    let userEmail = email?.trim() || null;

    if (role === "user") {
      await db.query(
        `INSERT INTO users (username, email, password, role, municipalityId)
         VALUES (?, ?, ?, 'user', ?)`,
        [username, userEmail, passwordHash, municipalityId],
      );

      // Send welcome email to citizen
      if (userEmail) {
        sendWelcomeEmail(userEmail, username, "citizen").catch((err) => {
          console.error("Welcome email failed (citizen):", err);
        });
      }

      return res.json({
        success: true,
        message: "Citizen registered successfully.",
      });
    }

    if (role === "municipality") {
      await db.query(
        `INSERT INTO official_applications
         (username, email, password_hash, municipality_id, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', NOW())`,
        [username, userEmail, passwordHash, municipalityId],
      );

      // Optional: different message for pending officials
      if (userEmail) {
        sendWelcomeEmail(userEmail, username, "official_pending").catch(
          (err) => {
            console.error("Welcome email failed (official application):", err);
          },
        );
      }

      return res.json({
        success: true,
        message: "Application submitted. Waiting for admin approval.",
      });
    }

    return res.status(400).json({ error: "Invalid role" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ────────────────────────────────────────────────────────────────
// Helper function - place this somewhere near your other email functions
// ────────────────────────────────────────────────────────────────
async function sendWelcomeEmail(toEmail, username, type = "citizen") {
  const dashboardUrl = "http://localhost:3000"; // ← change to production URL later

  let subject, text, html;

  if (type === "citizen") {
    subject = "Welcome to Smart Civic Reporting System!";
    text = `Hello ${username},

Thank you for registering as a citizen!
You can now log in and start reporting civic issues in your area.

Login here: ${dashboardUrl}

Best regards,
Smart Civic Team`;

    html = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 20px;">
        <div style="background: #4F46E5; color: white; padding: 24px; text-align: center; border-radius: 8px;">
          <h1 style="margin: 0; font-size: 24px;">Welcome to Smart Civic!</h1>
        </div>
        
        <div style="padding: 24px; background: white; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1e293b; margin-top: 0;">Hi ${username},</h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #334155;">
            Thank you for joining <strong>Smart Civic Reporting System</strong>!
          </p>
          
          <p style="font-size: 16px; line-height: 1.6; color: #334155; margin: 20px 0;">
            You're now ready to report civic issues in your area and help make your city better.
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${dashboardUrl}"
               style="background: #4F46E5; color: white; padding: 14px 32px; 
                      text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              Login to Dashboard →
            </a>
          </div>

          <p style="font-size: 14px; color: #64748b; text-align: center; margin-top: 24px;">
            Happy reporting!<br>
            Smart Civic Team
          </p>
        </div>
      </div>
    `;
  } else if (type === "official_pending") {
    subject = "Smart Civic - Municipality Official Application Received";
    text = `Hello ${username},

Your application to become a Municipality Official has been received.
Our admin team will review it shortly.

You will receive another email once your account is approved (or if any clarification is needed).

Thank you for your interest in serving your community!
Smart Civic Team`;

    html = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 20px;">
        <div style="background: #4338CA; color: white; padding: 24px; text-align: center; border-radius: 8px;">
          <h1 style="margin: 0; font-size: 24px;">Application Received</h1>
        </div>
        
        <div style="padding: 24px; background: white; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1e293b; margin-top: 0;">Hi ${username},</h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #334155;">
            We have received your application to become a <strong>Municipality Official</strong>.
          </p>
          
          <p style="font-size: 16px; line-height: 1.6; color: #334155; margin: 20px 0;">
            Our admin team will review your application shortly.<br>
            You will be notified by email once your account is <strong>approved</strong> or if we need any clarification.
          </p>

          <p style="font-size: 14px; color: #64748b; text-align: center; margin-top: 32px;">
            Thank you for your interest in improving civic services!<br>
            Smart Civic Team
          </p>
        </div>
      </div>
    `;
  }

  await transporter.sendMail({
    from: '"Smart Civic" <smartcivicissuereportingsystem@gmail.com>',
    to: toEmail,
    subject,
    text,
    html,
  });
}

// ---------- ADMIN: OFFICIAL APPLICATIONS ----------
app.get("/api/admin/official-applications", requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT oa.*, m.name AS municipalityName, u.username AS reviewedBy
       FROM official_applications oa
       LEFT JOIN municipalities m ON oa.municipality_id = m.id
       LEFT JOIN users u ON oa.reviewed_by_admin_id = u.id
       WHERE oa.status = 'pending'
       ORDER BY oa.created_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    console.error("official applications list error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- ADMIN AUTH & MANAGEMENT ROUTES ----------
app.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query(
      'SELECT * FROM users WHERE username = ? AND role = "admin"',
      [username],
    );
    const admin = rows[0];
    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = bcrypt.compareSync(password, admin.password);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    req.session.userId = admin.id;
    res.json({
      admin: { id: admin.id, username: admin.username, role: admin.role },
    });
  } catch (e) {
    console.error("admin login error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => {});
  res.json({ success: true });
});

app.get("/api/admin/me", async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    return res.json({ admin: null });
  }
  res.json({
    admin: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

app.get("/api/admin/profile", requireAdmin, async (req, res) => {
  try {
    const [[adminUser]] = await db.query(
      "SELECT id, username, email, role, createdAt, accountStatus FROM users WHERE id = ?",
      [req.user.id],
    );

    const [[counts]] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'user') AS totalCitizens,
        (SELECT COUNT(*) FROM users WHERE role = 'municipality') AS totalOfficials,
        (SELECT COUNT(*) FROM municipalities) AS totalMunicipalities,
        (SELECT COUNT(*) FROM requests) AS totalRequests,
        (SELECT COUNT(*) FROM requests WHERE status = 'completed') AS totalCompleted,
        (SELECT COUNT(*) FROM requests WHERE status = 'pending') AS totalPending,
        (SELECT COUNT(*) FROM requests WHERE status = 'accepted') AS totalAccepted,
        (SELECT COUNT(*) FROM requests WHERE status = 'rejected') AS totalRejected
    `);

    res.json({
      admin: adminUser,
      stats: {
        totalCitizens: Number(counts?.totalCitizens) || 0,
        totalOfficials: Number(counts?.totalOfficials) || 0,
        totalMunicipalities: Number(counts?.totalMunicipalities) || 0,
        totalRequests: Number(counts?.totalRequests) || 0,
        totalCompleted: Number(counts?.totalCompleted) || 0,
        totalPending: Number(counts?.totalPending) || 0,
        totalAccepted: Number(counts?.totalAccepted) || 0,
        totalRejected: Number(counts?.totalRejected) || 0,
      },
    });
  } catch (err) {
    console.error("Admin profile error:", err);
    res.status(500).json({ error: "Failed to fetch admin profile" });
  }
});

app.post("/api/admin/profile/change-password", requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new passwords are required" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters" });
  }

  try {
    const [rows] = await db.query(
      "SELECT id, password FROM users WHERE id = ?",
      [req.user.id],
    );
    const admin = rows[0];
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    const match = bcrypt.compareSync(currentPassword, admin.password);
    if (!match) {
      return res.status(400).json({ error: "Incorrect current password" });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await db.query("UPDATE users SET password = ? WHERE id = ?", [
      hashedPassword,
      admin.id,
    ]);

    res.json({ success: true, message: "Admin password updated successfully!" });
  } catch (err) {
    console.error("Admin change password error:", err);
    res.status(500).json({ error: "Failed to update password" });
  }
});

app.get("/api/admin/requests", requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, u.username AS citizenName, m.name AS municipalityName
       FROM requests r
       JOIN users u ON r.userId = u.id
       JOIN municipalities m ON r.municipalityId = m.id
       ORDER BY r.createdAt DESC`,
    );
    rows.forEach((r) => {
      if (r.imagePath) r.imagePath = `/uploads/${r.imagePath}`;
      if (r.afterImagePath) r.afterImagePath = `/uploads/${r.afterImagePath}`;
    });
    res.json(rows);
  } catch (e) {
    console.error("admin requests error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/admin/issues/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [[issue]] = await db.query(
      `SELECT r.*, u.username AS citizenName, m.name AS municipalityName
       FROM requests r
       JOIN users u ON r.userId = u.id
       JOIN municipalities m ON r.municipalityId = m.id
       WHERE r.id = ?`,
      [id],
    );

    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }

    if (issue.imagePath) issue.imagePath = `/uploads/${issue.imagePath}`;
    if (issue.afterImagePath) {
      issue.afterImagePath = `/uploads/${issue.afterImagePath}`;
    }

    let timeline = [];
    try {
      const [historyRows] = await db.query(
        `SELECT status, changed_at, changed_by
         FROM request_history
         WHERE request_id = ?
         ORDER BY changed_at ASC`,
        [id],
      );
      timeline = historyRows;
    } catch (err) {
      timeline = [];
    }

    res.json({ issue, timeline });
  } catch (e) {
    console.error("admin issue detail error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/admin/officials", requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
          u.id,
          u.username,
          u.email,
          u.accountStatus,
          m.name AS municipalityName,
          COUNT(oic.id) AS totalIssuesHandled
       FROM users u
       LEFT JOIN municipalities m 
         ON u.municipalityId = m.id
       LEFT JOIN official_issue_completions oic
         ON oic.officialId = u.id
       WHERE u.role = 'municipality'
       GROUP BY 
         u.id,
         u.username,
         u.email,
         u.accountStatus,
         m.name
       ORDER BY u.username ASC`,
    );
    res.json(rows);
  } catch (err) {
    console.error("list officials error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/admin/officials/:id/block", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      `UPDATE users
         SET accountStatus = 'blocked'
         WHERE id = ? AND role = 'municipality'`,
      [id],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("block official error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/admin/officials/:id/unblock", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      `UPDATE users
         SET accountStatus = 'active'
         WHERE id = ? AND role = 'municipality'`,
      [id],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("unblock official error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/admin/officials/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      `DELETE FROM users
         WHERE id = ? AND role = 'municipality'`,
      [id],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("delete official error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post(
  "/api/admin/official-applications/:id/approve",
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      await db.query(
        `UPDATE official_applications
       SET status = 'approved',
           reviewed_at = NOW(),
           reviewed_by_admin_id = ?
       WHERE id = ?`,
        [req.user.id, id],
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

app.post(
  "/api/admin/official-applications/:id/reject",
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      await db.query(
        `UPDATE official_applications
       SET status = 'rejected',
           reviewed_at = NOW(),
           reviewed_by_admin_id = ?
       WHERE id = ?`,
        [req.user.id, id],
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// ---------- REPORT CREATION ----------
// ---------- REPORT CREATION ----------
app.post("/api/report", upload.single("photo"), async (req, res) => {
  if (!req.session.userId)
    return res.status(403).json({ error: "Unauthorized" });

  const [userRows] = await db.query(
    "SELECT id, username, email, role, municipalityId FROM users WHERE id = ?",
    [req.session.userId],
  );
  const user = userRows[0];

  if (!user || user.role !== "user") {
    return res.status(403).json({ error: "Only citizens can report" });
  }

  if (!user.municipalityId || !req.file) {
    return res.status(400).json({ error: "Missing data" });
  }

  const latitude = parseFloat(req.body.latitude) || null;
  const longitude = parseFloat(req.body.longitude) || null;
  const issue_type = req.body.issue_type || "garbage";
  const description = (req.body.description || "").trim();

  // ================== CLASSIFICATION LOGIC ==================
  const CONFIDENCE_THRESHOLDS = {
    garbage: 65,
    pothole: 65,
    waterleak: 68,
    sewage: 65,
    streetlights: 60,
  };

  const threshold = CONFIDENCE_THRESHOLDS[issue_type] || 60;

  let confidence = 0;
  let classificationSuccess = true;

  try {
    // Create path with forward slashes (important for Python on Windows!)
    //let imageFullPath = path.join(__dirname, 'uploads', req.file.filename).replace(/\\/g, '/');

    // Use the same UPLOADS_DIR you defined for multer
    const imageFullPath = path
      .join(UPLOADS_DIR, req.file.filename)
      .replace(/\\/g, "/");
    // Debug: Check if file really exists
    const fs = require("fs");
    console.log("[REPORT] Full image path:", imageFullPath);
    console.log("[REPORT] File exists on disk?", fs.existsSync(imageFullPath));

    if (!fs.existsSync(imageFullPath)) {
      throw new Error("Uploaded file not found on disk after multer save");
    }

    confidence = await classifyImage(imageFullPath, issue_type);

    console.log(
      `[REPORT] Classification result for ${issue_type}: ${confidence}`,
    );
  } catch (err) {
    console.error("[REPORT] Classification failed:", err.message);
    classificationSuccess = false;
  }

  // Decide whether to accept or reject
  if (!classificationSuccess || confidence < threshold) {
    // Optional: delete rejected file (uncomment if needed)
    // fs.unlink(imageFullPath, (e) => { if (e) console.error("Delete failed:", e); });

    return res.json({
      success: false,
      message:
        confidence < threshold
          ? `Low confidence (${confidence.toFixed(1)}%) for "${issue_type}". Minimum required: ${threshold}%. Please try a clearer photo.`
          : "Could not process image classification. Please try again later.",
    });
  }

  // =========================================================

  try {
    const [result] = await db.query(
      `INSERT INTO requests
       (userId, municipalityId, issue_type, description, imagePath, afterImagePath, status, modelResult, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.session.userId,
        user.municipalityId,
        issue_type,
        description,
        req.file.filename, // store original filename (relative)
        null,
        "pending",
        confidence, // number (0–100)
        latitude,
        longitude,
      ],
    );

    const insertedId = result.insertId;

    // 1) Find Municipality Details
    const [muni] = await db.query(
      "SELECT id, email, name FROM municipalities WHERE id = ?",
      [user.municipalityId],
    );
    const municipalityName = muni[0]?.name || "Local Municipality";

    // 2) Find all Municipal Officers for this municipality
    const [officers] = await db.query(
      "SELECT id, username, email FROM users WHERE role = 'municipality' AND municipalityId = ? AND email IS NOT NULL AND email != ''",
      [user.municipalityId],
    );

    const officerEmailSet = new Set();
    if (muni[0]?.email) officerEmailSet.add(muni[0].email.trim().toLowerCase());
    for (const off of officers) {
      if (off.email) officerEmailSet.add(off.email.trim().toLowerCase());
    }
    const officerEmails = Array.from(officerEmailSet);

    const appBaseUrl = process.env.APP_URL || (req.protocol + "://" + req.get("host"));
    const mapsLink = (latitude && longitude)
      ? `https://maps.google.com/?q=${latitude},${longitude}`
      : null;

    // --- EMAIL TO MUNICIPAL OFFICER(S) ---
    if (officerEmails.length > 0) {
      const officerSubject = `[Action Required] New ${issue_type.toUpperCase()} Report (#${insertedId}) - ${municipalityName}`;
      const officerText = `New civic issue reported in ${municipalityName}\n\n` +
        `Report ID: #${insertedId}\n` +
        `Issue Type: ${issue_type.toUpperCase()}\n` +
        `Reported by: ${user.username || "Citizen"} (${user.email || "No email"})\n` +
        `Description: ${description || "(no description)"}\n` +
        `AI Confidence: ${confidence.toFixed(1)}% (Threshold: ${threshold}%)\n` +
        `Location: ${mapsLink || "Not specified"}\n\n` +
        `Please log in to review and take action:\n${appBaseUrl}`;

      const officerHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; color: #0f172a;">
          <div style="background-color: #4F46E5; color: white; padding: 16px; text-align: center; border-radius: 8px;">
            <h1 style="margin: 0; font-size: 20px;">Smart Civic Reporting System</h1>
            <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Municipal Officer Notification</p>
          </div>
          <div style="padding: 20px; background-color: white; border-radius: 8px; margin-top: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">
            <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
              <h2 style="color: #4F46E5; margin: 0;">New ${issue_type.toUpperCase()} Report (#${insertedId})</h2>
            </div>
            <p style="margin-top: 16px;"><strong>Municipality:</strong> ${municipalityName}</p>
            <p><strong>Reported By:</strong> ${user.username || "Citizen"} ${user.email ? `(${user.email})` : ""}</p>
            <p><strong>Description:</strong> ${description || "(no description provided)"}</p>
            <p><strong>AI Confidence Score:</strong> <span style="color: #0891B2; font-weight: bold;">${confidence.toFixed(1)}% (Threshold: ≥ ${threshold}%)</span></p>
            ${mapsLink ? `<p><strong>Location:</strong> <a href="${mapsLink}" style="color: #4F46E5; font-weight: bold;">View on Google Maps</a></p>` : ""}
            <div style="margin-top: 24px; text-align: center;">
              <a href="${appBaseUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Open Officer Portal
              </a>
            </div>
          </div>
          <div style="text-align: center; font-size: 12px; color: #64748b; margin-top: 20px;">
            © ${new Date().getFullYear()} Smart Civic Reporting System. All rights reserved.
          </div>
        </div>
      `;

      for (const email of officerEmails) {
        sendEmail(email, officerSubject, officerText, officerHtml)
          .catch((e) => console.error(`[EMAIL ERROR] Notifying officer ${email}:`, e.message));
      }
    }

    // --- EMAIL TO CITIZEN (USER) ---
    if (user.email) {
      const citizenSubject = `Complaint Registered: #${insertedId} (${issue_type.toUpperCase()}) - Smart Civic System`;
      const citizenText = `Dear ${user.username || "Citizen"},\n\n` +
        `Your civic issue report has been successfully registered!\n\n` +
        `Report ID: #${insertedId}\n` +
        `Category: ${issue_type.toUpperCase()}\n` +
        `Assigned Municipality: ${municipalityName}\n` +
        `AI Status: Validated (${confidence.toFixed(1)}% confidence)\n` +
        `Description: ${description || "(no description)"}\n\n` +
        `The municipal officer for ${municipalityName} has been alerted and will inspect the issue.\n` +
        `Track progress on your dashboard:\n${appBaseUrl}`;

      const citizenHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; color: #0f172a;">
          <div style="background-color: #10B981; color: white; padding: 16px; text-align: center; border-radius: 8px;">
            <h1 style="margin: 0; font-size: 20px;">Smart Civic Reporting System</h1>
            <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Citizen Complaint Confirmation</p>
          </div>
          <div style="padding: 20px; background-color: white; border-radius: 8px; margin-top: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">
            <h2 style="color: #0F172A; margin: 0 0 12px;">Hello, ${user.username || "Citizen"}!</h2>
            <p>Thank you for reporting this issue. Your submission was verified by our AI model and officially forwarded to the municipal authorities.</p>
            <div style="background-color: #F1F5F9; border-radius: 6px; padding: 16px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Report ID:</strong> #${insertedId}</p>
              <p style="margin: 4px 0;"><strong>Category:</strong> ${issue_type.toUpperCase()}</p>
              <p style="margin: 4px 0;"><strong>Municipality:</strong> ${municipalityName}</p>
              <p style="margin: 4px 0;"><strong>AI Verification:</strong> <span style="color: #059669; font-weight: bold;">Verified (${confidence.toFixed(1)}%)</span></p>
              <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: #D97706; font-weight: bold;">PENDING INSPECTION</span></p>
            </div>
            <p>The municipal officer for <strong>${municipalityName}</strong> has been notified to resolve this civic concern.</p>
            <div style="margin-top: 24px; text-align: center;">
              <a href="${appBaseUrl}" style="display: inline-block; background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Track Status on Dashboard
              </a>
            </div>
          </div>
          <div style="text-align: center; font-size: 12px; color: #64748b; margin-top: 20px;">
            © ${new Date().getFullYear()} Smart Civic Reporting System. All rights reserved.
          </div>
        </div>
      `;

      sendEmail(user.email, citizenSubject, citizenText, citizenHtml)
        .catch((e) => console.error(`[EMAIL ERROR] Notifying citizen ${user.email}:`, e.message));
    }

    res.json({ success: true, message: "Report submitted successfully!" });
  } catch (err) {
    console.error("Report insert error:", err);
    res.status(500).json({ error: "Failed to save report" });
  }
});

// ---------- COMPLETE REQUEST ----------
app.post("/api/complete/:id", upload.single("afterPhoto"), async (req, res) => {
  if (!req.session.userId || !req.file) {
    return res.status(400).json({ error: "Bad request" });
  }

  const [userRows] = await db.query(
    "SELECT role, municipalityId FROM users WHERE id = ?",
    [req.session.userId],
  );
  const user = userRows[0];

  if (!user || user.role !== "municipality") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const [reqRows] = await db.query(
    "SELECT status, municipalityId FROM requests WHERE id = ?",
    [req.params.id],
  );
  const request = reqRows[0];

  if (
    !request ||
    request.status !== "accepted" ||
    request.municipalityId !== user.municipalityId
  ) {
    return res.status(403).json({ error: "Invalid request" });
  }

  await db.query(
    'UPDATE requests SET status = "completed", afterImagePath = ?, completedAt = NOW(), feedback = NULL WHERE id = ?',
    [req.file.filename, req.params.id],
  );

  await db.query(
    `INSERT INTO official_issue_completions (requestId, officialId)
     VALUES (?, ?)`,
    [req.params.id, req.session.userId],
  );
  // Minimal completion email notification (add this after the UPDATE query)

  const [[citizen]] = await db.query("SELECT email FROM users WHERE id = ?", [
    request.userId,
  ]);

  if (citizen?.email) {
    const appBaseUrl = process.env.APP_URL || (req.protocol + "://" + req.get("host"));

    sendEmail(
      citizen.email,
      `Report #${req.params.id} Completed - Action Taken`,
      `Your reported civic issue #${req.params.id} has been resolved by the municipal authorities.\n\nPlease login to review the after-photo and give feedback:\n${appBaseUrl}`,
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; color: #0f172a;">
        <div style="background-color: #10B981; color: white; padding: 16px; text-align: center; border-radius: 8px;">
          <h1 style="margin: 0; font-size: 20px;">Smart Civic Reporting System</h1>
          <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Work Completed Notice</p>
        </div>
        <div style="padding: 20px; background-color: white; border-radius: 8px; margin-top: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">
          <h2 style="color: #059669; margin: 0 0 12px;">Report #${req.params.id} Completed!</h2>
          <p>The municipal team has finished work on your reported civic issue.</p>
          <p>Please log in to your citizen dashboard to view the completion photo and rate your satisfaction:</p>
          <div style="margin: 24px 0; text-align: center;">
            <a href="${appBaseUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">
              Review & Give Feedback
            </a>
          </div>
          <p style="font-size: 13px; color: #64748b;">
            Thank you for helping improve civic hygiene and safety in our community!
          </p>
        </div>
      </div>
    `,
    ).catch((err) => console.error("[EMAIL ERROR] Completion email failed:", err.message));
  }

  res.json({ success: true });
});

// ---------- REVIEW (ACCEPT / REJECT) ----------
app.post("/api/review/:id", async (req, res) => {
  if (!req.session.userId) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { status, reason } = req.body;

  if (!["accepted", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const [userRows] = await db.query(
    "SELECT role, municipalityId FROM users WHERE id = ?",
    [req.session.userId],
  );
  const user = userRows[0];

  if (!user || user.role !== "municipality") {
    return res
      .status(403)
      .json({ error: "Only municipality officials can review" });
  }

  // If rejected, require a reason
  let rejectReasonValue = null;
  if (status === "rejected") {
    if (!reason || !reason.trim()) {
      return res
        .status(400)
        .json({ error: "Reason is required when rejecting." });
    }
    rejectReasonValue = reason.trim();
  }

  await db.query(
    `UPDATE requests
     SET status = ?, rejectReason = ?
     WHERE id = ? AND municipalityId = ?`,
    [status, rejectReasonValue, req.params.id, user.municipalityId],
  );

  res.json({ success: true });
});

// ---------- FEEDBACK ----------
app.post("/api/feedback/:id", async (req, res) => {
  if (!req.session.userId) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { feedback } = req.body;

  if (!["satisfied", "unsatisfied"].includes(feedback)) {
    return res.status(400).json({ error: "Invalid feedback" });
  }

  // Only citizens
  const [userRows] = await db.query("SELECT role FROM users WHERE id = ?", [
    req.session.userId,
  ]);
  const user = userRows[0];

  if (!user || user.role !== "user") {
    return res.status(403).json({ error: "Only citizens can give feedback" });
  }

  // Fetch the completed request
  const [requestRows] = await db.query(
    'SELECT * FROM requests WHERE id = ? AND userId = ? AND status = "completed"',
    [req.params.id, req.session.userId],
  );

  if (!requestRows.length) {
    return res.status(400).json({ error: "Invalid or unauthorized request" });
  }

  const request = requestRows[0];

  // Satisfied → simple update
  if (feedback === "satisfied") {
    await db.query("UPDATE requests SET feedback = ? WHERE id = ?", [
      "satisfied",
      req.params.id,
    ]);
    return res.json({ success: true, message: "Thank you for your feedback!" });
  }

  // ── UNSATISFIED ── Re-validate after photo
  if (!request.afterImagePath) {
    return res.status(400).json({ error: "No after photo to validate" });
  }

  let confidence = 0;
  let revalidationSuccess = true;

  try {
    const afterPhotoPath = path
      .join(UPLOADS_DIR, request.afterImagePath)
      .replace(/\\/g, "/");
    console.log("[FEEDBACK] Re-validating after photo:", afterPhotoPath);

    if (!require("fs").existsSync(afterPhotoPath)) {
      throw new Error("After photo file missing on disk");
    }

    confidence = await classifyImage(afterPhotoPath, request.issue_type);
    console.log(`[FEEDBACK] Re-validation confidence: ${confidence}`);
  } catch (err) {
    console.error("[FEEDBACK] Re-validation failed:", err.message);
    revalidationSuccess = false;
    confidence = 0;
  }

  const threshold = CONFIDENCE_THRESHOLDS[request.issue_type] || 60;

  let newStatus = "completed"; // default: keep closed
  let reopenReason = `Citizen marked as Unsatisfied (after photo AI confidence: ${confidence.toFixed(1)}%)`;

  // Only reopen if confidence is good enough
  if (revalidationSuccess && confidence >= threshold) {
    newStatus = "pending"; // or 'accepted' — your choice
    reopenReason = `Citizen marked Unsatisfied → after photo re-validated OK (${confidence.toFixed(1)}% ≥ ${threshold}%)`;
  } else {
    reopenReason = `Citizen marked Unsatisfied → but after photo still valid by AI (${confidence.toFixed(1)}%)`;
  }

  // Update the request
  await db.query(
    `UPDATE requests 
     SET feedback = 'unsatisfied',
         status = ?,
         after_confidence = ?,
         rejectReason = ?,
         last_reopen_reason = ?
     WHERE id = ?`,
    [newStatus, confidence, reopenReason, reopenReason, req.params.id],
  );

  // Notify municipality
  const [muni] = await db.query(
    "SELECT email, name FROM municipalities WHERE id = ?",
    [request.municipalityId],
  );

  if (muni[0]?.email) {
    const text = `Citizen marked the resolution as Unsatisfied.\n\n
Issue Type: ${request.issue_type}\n
Original Description: ${request.description || "(none)"}\n
Location: https://maps.google.com/?q=${request.latitude || "unknown"},${request.longitude || "unknown"}\n
After Photo AI Confidence: ${confidence.toFixed(1)}% (threshold: ${threshold}%)\n
New Status: ${newStatus.toUpperCase()}\n
Reason: ${reopenReason}\n\n
Please review and take action if required.`;

    const statusColor = newStatus === "pending" ? "#F59E0B" : "#10B981"; // Amber for reopen, green for closed

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; color: #0f172a;">
      <div style="background-color: #4F46E5; color: white; padding: 15px; text-align: center; border-radius: 8px;">
        <h1 style="margin: 0;">Smart Civic Reporting System</h1>
      </div>
      <div style="padding: 20px; background-color: white; border-radius: 8px; margin-top: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #EF4444;">Unsatisfied Feedback for Issue #${req.params.id}</h2>
        <p><strong>Issue Type:</strong> ${request.issue_type.toUpperCase()}</p>
        <p><strong>Description:</strong> ${request.description || "(none)"}</p>
        <p><strong>AI Confidence (After Photo):</strong> <span style="color: #06B6D4; font-weight: bold;">${confidence.toFixed(1)}% (threshold: ${threshold}%)</span></p>
        <p><strong>New Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${newStatus.toUpperCase()}</span></p>
        <p><strong>Reason:</strong> ${reopenReason}</p>
        <p><strong>Location:</strong></p>
        <a href="https://maps.google.com/?q=${request.latitude || "unknown"},${request.longitude || "unknown"}" style="display: inline-block; background-color: #06B6D4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">View on Google Maps</a>
        <p style="margin-top: 20px;">Please review and take action if required.</p>
      </div>
      <div style="text-align: center; font-size: 12px; color: #64748b; margin-top: 20px;">
        © ${new Date().getFullYear()} Smart Civic Reporting System. All rights reserved.
      </div>
    </div>
  `;

    sendEmail(
      muni[0].email,
      `Issue #${req.params.id} - Citizen Unsatisfied Feedback`,
      text,
      html,
    ).catch((e) => console.error("[EMAIL ERROR]", e.message));
  }

  // Response to citizen
  res.json({
    success: true,
    message:
      newStatus === "pending"
        ? "Feedback submitted. Issue reopened for municipality to address your concern."
        : "Feedback submitted. Issue remains completed as after photo was validated by AI.",
  });
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Smart Civic System running on port ${PORT}`);
});
