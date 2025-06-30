// server.js
const express = require("express");
const cors = require("cors");
const uploadRoute = require("./routes/upload");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use("/api/upload", uploadRoute);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
