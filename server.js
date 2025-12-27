// Load environment variables from univ.env
require("dotenv").config({ path: "univ.env" });

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Local JSON "database" file path
const DATA_FILE = path.join(process.cwd(), "data", "certificates.json");

// Optional folder to store uploaded PDFs
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

/**
 * Read database from data/certificates.json
 * If file doesn't exist or is broken, return empty array.
 */
async function readDb() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return { certificates: parsed.certificates || [] };
  } catch {
    return { certificates: [] };
  }
}

/**
 * Write database back to data/certificates.json
 */
async function writeDb(db) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

/**
 * Compute MD5 hash for a Buffer
 * This is the fingerprint of the uploaded file bytes.
 */
function md5Buffer(buf) {
  return crypto.createHash("md5").update(buf).digest("hex");
}

/**
 * Multer setup:
 * - memoryStorage() keeps uploaded file in RAM (req.file.buffer)
 *   so we can hash it easily.
 * - limit file size to 20 MB.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

// Serve static HTML pages from /public
app.use(express.static(path.join(process.cwd(), "public")));

/**
 * UNIVERSITY UPLOAD ENDPOINT
 * POST /api/university/upload
 *
 * Form fields:
 * - token (must match ADMIN_TOKEN)
 * - studentName, degree, issueDate
 * - pdf (file)
 *
 * Steps:
 * 1) Validate token
 * 2) Validate file is PDF
 * 3) Compute MD5 for file
 * 4) Store file in uploads/ (optional)
 * 5) Save record in data/certificates.json
 */
app.post("/api/university/upload", upload.single("pdf"), async (req, res) => {
  try {
    const token = (req.body.token || "").toString().trim();

    // Simple auth check
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ ok: false, message: "Unauthorized (token)" });
    }

    // File validation
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ ok: false, message: "PDF file is required" });
    }

    // Basic MIME check
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ ok: false, message: "Only PDF is allowed" });
    }

    // Metadata validation
    const studentName = (req.body.studentName || "").toString().trim();
    const degree = (req.body.degree || "").toString().trim();
    const issueDate = (req.body.issueDate || "").toString().trim();

    if (!studentName || !degree || !issueDate) {
      return res.status(400).json({ ok: false, message: "Missing fields" });
    }

    // Compute MD5 fingerprint
    const md5 = md5Buffer(req.file.buffer);

    // Create an ID for the stored file / record
    const id = crypto.randomBytes(8).toString("hex");
    const filename = `${id}.pdf`;

    // Store PDF locally (optional)
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOADS_DIR, filename), req.file.buffer);

    // Load database
    const db = await readDb();

    // Prevent duplicates by MD5
    const exists = db.certificates.find(c => c.md5 === md5);
    if (exists) {
      return res.json({
        ok: true,
        message: "Certificate already exists with the same MD5",
        md5,
        certificate: exists
      });
    }

    // Store record
    const record = {
      id,
      md5,
      studentName,
      degree,
      issueDate,
      storedFile: filename,
      createdAt: new Date().toISOString()
    };

    db.certificates.unshift(record);
    await writeDb(db);

    return res.json({ ok: true, md5, certificate: record });
  } catch (e) {
    return res.status(500).json({ ok: false, message: "Server error", error: String(e) });
  }
});

/**
 * USER VERIFY ENDPOINT
 * POST /api/verify
 *
 * User uploads a PDF:
 * 1) Compute MD5
 * 2) Search db for matching md5
 * 3) Return valid true/false
 */
app.post("/api/verify", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ ok: false, message: "PDF file is required" });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ ok: false, message: "Only PDF is allowed" });
    }

    const md5 = md5Buffer(req.file.buffer);
    const db = await readDb();

    const found = db.certificates.find(c => c.md5 === md5);

    if (!found) {
      return res.json({ ok: true, valid: false, md5, message: "No match found" });
    }

    return res.json({
      ok: true,
      valid: true,
      md5,
      certificate: {
        studentName: found.studentName,
        degree: found.degree,
        issueDate: found.issueDate,
        createdAt: found.createdAt
      }
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: "Server error", error: String(e) });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`UniVerify running at: http://localhost:${PORT}`);
});
