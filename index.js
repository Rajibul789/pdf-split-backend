const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" });

app.get("/check-gs", (req, res) => {
  const { exec } = require("child_process");

  exec("which gs && gs --version", (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: err.message,
        stderr
      });
    }
    res.json({
      success: true,
      output: stdout
    });
  });
});

app.post("/split", upload.single("pdf"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const inputPath = req.file.path;
  const jobId = Date.now().toString();
  const outputDir = path.join(__dirname, "files", jobId);

  fs.mkdirSync(outputDir, { recursive: true });

  const cmd = `/usr/bin/gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=pdfwrite -sOutputFile=${outputDir}/page_%03d.pdf ${inputPath}`;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error("GS ERROR:", stderr || error.message);
      return res.status(500).json({
        error: "Ghostscript failed",
        details: stderr || error.message
      });
    }

    const files = fs.readdirSync(outputDir).map(file => ({
      name: file,
      url: `/files/${jobId}/${file}`
    }));

    res.json(files);
  });
});

app.use("/files", express.static(path.join(__dirname, "files")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
