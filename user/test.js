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

app.use(
  session({
    secret: "secret123tejaproject",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
  }),
);

// ---------- DB POOL ----------
const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "root",
  database: "civicdb",
});

// ---------- EMAIL ----------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "smartcivicissuereportingsystem@gmail.com",
    pass: "exkm tmea ghdu fcdm", // app password
  },
});

const sendEmail = async (to, subject, text, html) => {
  try {
    await transporter.sendMail({
      from: "Smart Civic System <smartcivicissuereportingsystem@gmail.com>",
      to,
      subject,
      text, // Plain text fallback
      html, // Styled HTML version
    });
  } catch (err) {
    console.error("Email failed:", err);
  }
};

// ---------- IMAGE CLASSIFICATION ----------
const classifyImage = (imagePath, category) => {
  return new Promise((resolve) => {
    const command = `python classify.py "${imagePath}" "${category}"`;

    console.log("[CLASSIFY] Executing command:", command);
    console.log("[CLASSIFY] Current directory:", __dirname);
    console.log(
      "[CLASSIFY] Image path exists?",
      require("fs").existsSync(imagePath),
    );

    exec(command, (error, stdout, stderr) => {
      console.log("[CLASSIFY] ───────────────────────────────────────");
      console.log("[CLASSIFY] error:", error);
      console.log("[CLASSIFY] stdout:", stdout);
      console.log("[CLASSIFY] stderr:", stderr);
      console.log("[CLASSIFY] ───────────────────────────────────────");

      if (error) {
        console.error("[CLASSIFY] Execution failed:", error.message);
        resolve(0);
        return;
      }

      const output = stdout ? stdout.trim() : "";
      const confidence = parseFloat(output) || 0;

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
  garbage: 70,
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
      `SELECT u.id, u.username, u.role, u.municipalityId, m.name AS municipalityName
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
  const [rows] = await db.query(
    `SELECT r.*, m.name AS municipalityName
     FROM requests r
     JOIN municipalities m ON r.municipalityId = m.id
     ORDER BY r.createdAt DESC`,
  );

  rows.forEach((r) => {
    r.imagePath = `/uploads/${r.imagePath}`;
    if (r.afterImagePath) r.afterImagePath = `/uploads/${r.afterImagePath}`;
  });

  res.json(rows);
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
      "SELECT * FROM official_applications ORDER BY created_at DESC",
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
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
app.post("/api/report", upload.single("photo"), async (req, res) => {
  if (!req.session.userId)
    return res.status(403).json({ error: "Unauthorized" });

  const [userRows] = await db.query(
    "SELECT role, municipalityId FROM users WHERE id = ?",
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
    garbage: 70,
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

    const [muni] = await db.query(
      "SELECT email, name FROM municipalities WHERE id = ?",
      [user.municipalityId],
    );

    if (muni[0]?.email) {
      const text = `New report in ${muni[0].name}
Description: ${description || "(no description)"}
Location: https://maps.google.com/?q=${latitude || "unknown"},${longitude || "unknown"}
AI Confidence: ${confidence.toFixed(1)}% (threshold: ${threshold}%)`;

      const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; color: #0f172a;">
      <div style="background-color: #4F46E5; color: white; padding: 15px; text-align: center; border-radius: 8px;">
        <h1 style="margin: 0;">Smart Civic Reporting System</h1>
      </div>
      <div style="padding: 20px; background-color: white; border-radius: 8px; margin-top: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #4F46E5;">New ${issue_type.toUpperCase()} Report (#${insertedId})</h2>
        <p><strong>Municipality:</strong> ${muni[0].name}</p>
        <p><strong>Description:</strong> ${description || "(no description)"}</p>
        <p><strong>AI Confidence:</strong> <span style="color: #06B6D4; font-weight: bold;">${confidence.toFixed(1)}% (threshold: ${threshold}%)</span></p>
        <p><strong>Location:</strong></p>
        <a href="https://maps.google.com/?q=${latitude || "unknown"},${longitude || "unknown"}" style="display: inline-block; background-color: #06B6D4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">View on Google Maps</a>
      </div>
      <div style="text-align: center; font-size: 12px; color: #64748b; margin-top: 20px;">
        © ${new Date().getFullYear()} Smart Civic Reporting System. All rights reserved.
      </div>
    </div>
  `;

      await sendEmail(
        muni[0].email,
        `New ${issue_type} Report (#${insertedId})`,
        text,
        html,
      );
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
    const url = "http://localhost:3000"; // ← change to real URL later

    await transporter
      .sendMail({
        from: '"Smart Civic" <smartcivicissuereportingsystem@gmail.com>',
        to: citizen.email,
        subject: `Report #${req.params.id} Completed`,
        text: `Your reported issue has been completed.\n\nPlease login to give feedback:\n${url}`,
        html: `
      <h2 style="color:#10b981">Report #${req.params.id} Completed</h2>
      <p>The municipality has finished working on your issue.</p>
      <p>Please tell us if you're satisfied:</p>
      <a href="${url}" style="background:#4f46e5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
        Give Feedback
      </a>
      <p style="margin-top:24px;font-size:13px;color:#666;">
        Thank you for helping improve your city!
      </p>
    `,
      })
      .catch((err) => console.error("Completion email failed:", err));
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

    await sendEmail(
      muni[0].email,
      `Issue #${req.params.id} - Citizen Unsatisfied Feedback`,
      text,
      html,
    );
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
app.listen(3000, () => {
  console.log("Smart Civic System running on http://localhost:3000");
});
