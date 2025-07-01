// routes/upload.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const extractCompanyNames = require("../services/pdfProcessor");
const { scrapeMultiple } = require("../services/scraper");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const pdfPath = path.resolve(req.file.path);
    const companyNames = await extractCompanyNames(pdfPath);
    fs.unlinkSync(pdfPath); // cleanup

    if (!companyNames.length) {
      return res.status(400).json({ error: "No company names found" });
    }

    const enrichedData = await scrapeMultiple(companyNames);
    res.json({ enrichedData });
  } catch (err) {
    console.error("Upload route error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
