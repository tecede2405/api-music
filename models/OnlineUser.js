const mongoose = require("mongoose");

const OnlineUserSchema = new mongoose.Schema({
  visitorId: String,
  ip: String,
  page: String,
  socketId: String,
  lastActive: Date,
});

module.exports = mongoose.model("OnlineUser", OnlineUserSchema);
