const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" });

app.post("/split", upload.single("pdf"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const inputPath = req.file.path;
  const outputDir = `output_${Date.now()}`;
  fs.mkdirSync(outputDir);

  const cmd = `gs -sDEVICE=pdfwrite -dSAFER -dBATCH -dNOPAUSE -sOutputFile=${outputDir}/page_%03d.pdf ${inputPath}`;

  exec(cmd, (err) => {
    if (err) {
      return res.status(500).json({ error: "Ghostscript failed" });
    }

    const files = fs.readdirSync(outputDir).map(file => ({
      name: file,
      url: `/files/${outputDir}/${file}`
    }));

    res.json(files);
  });
});

app.use("/files", express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
