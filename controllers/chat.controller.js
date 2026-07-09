const chatService = require("../services/chat.service");

class ChatController {
  async chat(req, res) {
    const { messages } = req.body;

    try {
      const data = await chatService.chat(messages);
      res.json(data);
    } catch (error) {
      console.error("❌ Lỗi khi gọi OpenRouter:", error);
      res.status(500).json({ error: "Lỗi server khi gọi OpenRouter." });
    }
  }
}

module.exports = new ChatController();