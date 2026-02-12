const mongoose = require("mongoose");

const VisitLogSchema = new mongoose.Schema({
  ip: String,
  page: String,
  device: String,
  os: String,
  browser: String,

  visitedAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24, // 🔥 24 giờ = tự xoá
  },
});

module.exports = mongoose.model("VisitLog", VisitLogSchema);
