const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");

// Đăng ký nhận thông báo - path gốc: /api/songs/subscribe
router.post("/subscribe", notificationController.subscribe);

// Gửi thông báo đến tất cả - path gốc: /api/songs/send-notification
router.post("/send-notification", notificationController.send);

module.exports = router;