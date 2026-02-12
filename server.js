const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const http = require("http");

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
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => console.log("✅ MongoDB connected!"))
  .catch((err) => console.error("❌ MongoDB connect failed:", err));

/* ================= HTTP SERVER ================= */
const server = http.createServer(app);

/* ================= SOCKET.IO INIT ================= */
// 🔥 CHỈ KHỞI TẠO SOCKET 1 LẦN Ở ĐÂY
require("./socket").init(server);

/* ================= ROUTES ================= */

// Test
app.get("/", (req, res) => {
  res.send("API is working!");
});

// Chat bot
app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b:free",
          messages,
        }),
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("❌ Lỗi khi gọi OpenRouter:", error);
    res.status(500).json({ error: "Lỗi server khi gọi OpenRouter." });
  }
});

// Songs
app.use("/api/songs", require("./routes/song.route"));

// Auth
app.use("/api/auth", require("./routes/auth.route"));

// Analytics
app.use("/api/track", require("./routes/track.route"));
app.use("/api/stats", require("./routes/stats.route"));

/* ================= PUSH NOTIFICATION ================= */
const { addSubscription, webpush, getSubscriptions } = require("./push");

app.post("/api/songs/subscribe", (req, res) => {
  addSubscription(req.body);
  res.status(201).json({ message: "Subscribed thành công!" });
});

app.post("/api/songs/send-notification", async (req, res) => {
  const { title, body } = req.body;
  const payload = JSON.stringify({
    title,
    body,
    icon: "/logo192.png",
  });

  try {
    const subscriptions = await getSubscriptions();
    for (const sub of subscriptions) {
      await webpush.sendNotification(sub, payload).catch(console.error);
    }
    res.json({ message: "Thông báo đã được gửi!" });
  } catch (err) {
    console.error("❌ Lỗi gửi thông báo:", err);
    res.status(500).json({ error: "Gửi thông báo thất bại" });
  }
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
