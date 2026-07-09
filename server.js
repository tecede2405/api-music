const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/database");
const routes = require("./routes");

const app = express();
app.set("trust proxy", true);

/* ================= CORS ================= */
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://tecede.vercel.app",
      "https://tecede.netlify.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

/* ================= MONGODB ================= */
connectDB();

/* ================= ROUTES ================= */
app.use(routes);

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});