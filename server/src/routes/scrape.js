const express = require("express");
const router = express.Router();

router.post("/scrape", async (req, res) => {
  const { companies } = req.body;
  if (!companies || !Array.isArray(companies)) {
    return res.status(400).json({ error: "Invalid companies list" });
  }

  const data = await scrapeMultiple(companies);
  res.json(data);
});

module.exports = router;
