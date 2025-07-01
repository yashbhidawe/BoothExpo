// server.js
const express = require("express");
const cors = require("cors");
const uploadRoute = require("./routes/upload");
const scrapeRoute = require("./routes/scrape");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use("/api/upload", uploadRoute);
app.use("/api/scrape", scrapeRoute);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
