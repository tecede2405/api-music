const express = require("express");
const router = express.Router();

// Test route
router.get("/", (req, res) => {
  res.send("API is working!");
});

// Song routes
router.use("/api/songs", require("./song.route"));

// Storage routes
router.use("/api/storage", require("./storage.route"));

// Auth routes
router.use("/api/auth", require("./auth.route"));

// Chat routes
router.use("/api/chat", require("./chat.route"));

// Notification routes (giữ nguyên path gốc: /api/songs/subscribe, /api/songs/send-notification)
router.use("/api/songs", require("./notification.route"));

module.exports = router;