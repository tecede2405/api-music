const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat.controller");

// Chat AI
router.post("/", chatController.chat);

module.exports = router;