const express = require("express");
const mysql = require("mysql2/promise");
const session = require("express-session");
const path = require("path");
const bcrypt = require("bcryptjs");

const app = express();

const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
app.use("/uploads", express.static(UPLOADS_DIR));

app.use(express.json());
app.use(express.static(__dirname));

app.use(
  session({
    secret: "admin-secret-123",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
  }),
);

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "abhiteja2005",
  database: "civicdb",
});

// attach req.user from session
app.use(async (req, res, next) => {
  if (!req.session.userId) {
    req.user = null;
    return next();
  }
  try {
    const [rows] = await db.query(
      "SELECT id, username, role FROM users WHERE id = ?",
      [req.session.userId],
    );
    req.user = rows[0] || null;
  } catch (e) {
    console.error("admin req.user error:", e);
    req.user = null;
  }
  next();
});

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

// serve admin SPA
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "admin-index.html"));
});

// ---------- ADMIN LOGIN ----------
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
      role: req.user.role,
    },
  });
});

// ---------- ADMIN DATA: MUNICIPALITY ISSUES ----------
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

// Single issue detail + basic timeline
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

    // Optional: simple timeline from a request_history table if you add it
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
      // If table not present, just return empty timeline
      timeline = [];
    }

    res.json({ issue, timeline });
  } catch (e) {
    console.error("admin issue detail error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- ADMIN: MUNICIPALITY OFFICIAL APPLICATIONS ----------
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
      console.error("approve official application error:", err);
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
      console.error("reject official application error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// ---------- ADMIN: MUNICIPALITY OFFICIALS LIST ----------
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

// Block a municipality official
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

// Unblock a municipality official
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

// Permanently remove a municipality official
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

// ---------- START ADMIN SERVER ----------
app.listen(4000, () => {
  console.log("Admin server running on http://localhost:4000");
});
