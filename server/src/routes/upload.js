// routes/upload.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const extractCompanyNames = require("../services/pdfProcessor");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      console.log("no file found");
      return res.status(400).json({ error: "No file uploaded." });
    }
    console.log("file", req.file);

    const pdfPath = path.resolve(req.file.path);
    const names = await extractCompanyNames(pdfPath);
    fs.unlinkSync(pdfPath); // cleanup

    res.json({ companies: names });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "PDF processing failed." });
  }
});

module.exports = router;
