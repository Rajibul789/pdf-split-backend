const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();

// ✅ Ensure writable temp folders exist
if (!fs.existsSync("/tmp/uploads")) {
  fs.mkdirSync("/tmp/uploads", { recursive: true });
}

if (!fs.existsSync("/tmp/files")) {
  fs.mkdirSync("/tmp/files", { recursive: true });
}

// ✅ Use /tmp for uploads
const upload = multer({ dest: "/tmp/uploads" });

// ---------------- CHECK GS ----------------
app.get("/check-gs", (req, res) => {
  exec("/usr/bin/gs --version", (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ success: false, error: stderr });
    }
    res.json({ success: true, version: stdout.trim() });
  });
});

// ---------------- SPLIT PDF ----------------
app.post("/split", upload.single("pdf"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No PDF uploaded" });
  }

  const inputPath = req.file.path;
  const jobId = Date.now().toString();

  // ✅ Use /tmp for output
  const outputDir = path.join("/tmp", "files", jobId);
  fs.mkdirSync(outputDir, { recursive: true });

  const cmd = `/usr/bin/gs -dSAFER -dBATCH -dNOPAUSE \
    -sDEVICE=pdfwrite \
    -sOutputFile=${outputDir}/page_%03d.pdf \
    ${inputPath}`;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error("GS ERROR:", stderr);
      return res.status(500).json({ error: "Ghostscript failed", details: stderr });
    }

    const files = fs.readdirSync(outputDir);
    if (!files.length) {
      return res.status(500).json({ error: "No pages generated" });
    }

    res.json(
      files.map(file => ({
        name: file,
        url: `/files/${jobId}/${file}`
      }))
    );
  });
});

// ✅ Serve files from /tmp
app.use("/files", express.static("/tmp/files"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
