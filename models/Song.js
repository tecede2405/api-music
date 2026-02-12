const mongoose = require("mongoose");

const SongSchema = new mongoose.Schema({
  title: String,
  artist: String,
  image: String,  // ảnh đại diện
  file: String,   // file mp3
  category: String,
  listens: {
      type: Number,
      default: 0,     // ✅ thêm lượt nghe, mặc định 0
    },
}, {
  timestamps: true, // ✅ Tự động tạo createdAt và updatedAt
});

module.exports = mongoose.model("Song", SongSchema);
