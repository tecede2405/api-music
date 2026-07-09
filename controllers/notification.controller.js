const notificationService = require("../services/notification.service");

class NotificationController {
  async subscribe(req, res) {
    try {
      await notificationService.subscribe(req.body);
      res.status(201).json({ message: "Subscribed thành công!" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async send(req, res) {
    try {
      const { title, body } = req.body;
      await notificationService.sendToAll({
        title,
        body,
        icon: "/logo192.png",
      });
      res.json({ message: "Thông báo đã được gửi!" });
    } catch (err) {
      console.error("❌ Lỗi gửi thông báo:", err);
      res.status(500).json({ error: "Gửi thông báo thất bại" });
    }
  }
}

module.exports = new NotificationController();