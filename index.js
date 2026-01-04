const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();

/* -------------------------------------------------
   ENSURE RENDER WRITABLE DIRECTORIES EXIST
------------------------------------------------- */
const TMP_UPLOADS = "/tmp/uploads";
const TMP_FILES = "/tmp/files";

if (!fs.existsSync(TMP_UPLOADS)) {
  fs.mkdirSync(TMP_UPLOADS, { recursive: true });
}

if (!fs.existsSync(TMP_FILES)) {
  fs.mkdirSync(TMP_FILES, { recursive: true });
}

/* -------------------------------------------------
   MULTER CONFIG (RENDER-SAFE)
------------------------------------------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TMP_UPLOADS);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
});

/* -------------------------------------------------
   CHECK GHOSTSCRIPT
------------------------------------------------- */
app.get("/check-gs", (req, res) => {
  exec("/usr/bin/gs --version", (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: stderr || err.message
      });
    }
    res.json({
      success: true,
      version: stdout.trim()
    });
  });
});

/* -------------------------------------------------
   TEST FILE UPLOAD ONLY (NO GS)
------------------------------------------------- */
app.post("/test-upload", upload.single("pdf"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Upload failed"
    });
  }

  res.json({
    success: true,
    file: {
      path: req.file.path,
      size: req.file.size,
      originalName: req.file.originalname
    }
  });
});

/* -------------------------------------------------
   SPLIT PDF USING GHOSTSCRIPT
------------------------------------------------- */
app.post("/split", upload.single("pdf"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      stage: "upload",
      message: "No PDF received"
    });
  }

  const inputPath = req.file.path;
  const jobId = Date.now().toString();
  const outputDir = path.join(TMP_FILES, jobId);

  fs.mkdirSync(outputDir, { recursive: true });

  const cmd = `/usr/bin/gs -dSAFER -dBATCH -dNOPAUSE \
-sDEVICE=pdfwrite \
-sOutputFile=${outputDir}/page_%03d.pdf \
"${inputPath}"`;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        success: false,
        stage: "ghostscript",
        message: error.message,
        stderr: stderr
      });
    }

    let files;
    try {
      files = fs.readdirSync(outputDir);
    } catch (e) {
      return res.status(500).json({
        success: false,
        stage: "filesystem",
        message: e.message
      });
    }

    if (!files.length) {
      return res.status(500).json({
        success: false,
        stage: "ghostscript",
        message: "No output files generated"
      });
    }

    res.json(
      files.map(file => ({
        name: file,
        url: `/files/${jobId}/${file}`
      }))
    );
  });
});

/* -------------------------------------------------
   SERVE SPLIT FILES
------------------------------------------------- */
app.use("/files", express.static(TMP_FILES));

/* -------------------------------------------------
   START SERVER
------------------------------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
