const mongoose = require("mongoose");

const StorageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["image", "video"], required: true },
  fileId: { type: String, required: true }, // Telegram File ID
  size: { type: Number },
}, {
  timestamps: true
});

module.exports = mongoose.model("Storage", StorageSchema);