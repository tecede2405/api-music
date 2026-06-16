const express = require("express");
const router = express.Router();
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const Song = require("../models/Song");
const slugify = require("slugify");
const { webpush, getSubscriptions } = require("../push");

// ✅ Import thêm thư viện https của Node.js để xử lý luồng (stream) mượt mà hơn
const https = require("https");

/* ================== CACHE LINK TELEGRAM (TỐI ƯU TỐC ĐỘ CHUYỂN BÀI) ================== */
// Map này lưu tạm file_path từ Telegram trên RAM Server, tránh việc phải hỏi lại liên tục
const telegramCache = new Map();

/* ================== UPLOAD CONFIG ================== */
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Telegram hỗ trợ Bot up tối đa 50MB
}).single("file");

/* ================== UPLOAD LÊN TELEGRAM ================== */

// Upload 1 bài
router.post("/upload", upload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "❌ Không có file được tải lên" });
    }

    const { title, artist, image, category } = req.body;

    // 1. Đóng gói file từ RAM (buffer) để gửi lên Telegram
    const form = new FormData();
    form.append("chat_id", process.env.TELE_CHAT_ID);
    form.append("audio", req.file.buffer, {
      filename: req.file.originalname || "audio.mp3",
      contentType: req.file.mimetype || "audio/mpeg",
    });
    form.append("title", title || "Unknown Title");
    form.append("performer", artist || "Unknown Artist");

    // 2. Gửi request lên Telegram Bot API
    const teleRes = await axios.post(
      `https://api.telegram.org/bot${process.env.TELE_BOT_TOKEN}/sendAudio`,
      form,
      { headers: form.getHeaders() }
    );

    // Lấy file_id từ kết quả trả về
    const fileId = teleRes.data.result.audio.file_id;

    // 3. Lưu DB (Trường file lúc này sẽ lưu fileId thay vì link mp3)
    const newSong = await Song.create({
      title,
      artist,
      image,
      file: fileId, // ✅ Lưu fileId của Telegram
      category,
      listens: 0,
    });

    res.status(201).json({
      message: "✅ Thêm bài hát lên Telegram thành công",
      data: newSong,
    });

    /* ========= PUSH BACKGROUND ========= */
    setImmediate(async () => {
      try {
        const payload = JSON.stringify({
          title: "🎵 Bài hát mới!",
          body: `Vừa thêm bài hát: ${newSong.title} - ${newSong.artist}`,
          icon: "/logo192.png",
        });

        const subscriptions = await getSubscriptions();
        for (const sub of subscriptions) {
          webpush.sendNotification(sub, payload).catch(console.error);
        }
      } catch (err) {
        console.error("Push error:", err);
      }
    });

  } catch (err) {
    console.error("❌ Upload failed:", err.response ? err.response.data : err.message);
    return res.status(500).json({ error: "Lỗi hệ thống khi upload" });
  }
});

/* ================== STREAM NHẠC TỪ TELEGRAM (CÓ TUA + CACHE SIÊU NHANH) ================== */
router.get("/stream/:id", async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song || !song.file) return res.status(404).json({ error: "Không tìm thấy bài hát" });

    // ✅ Tương thích ngược: Nếu bài này vẫn là link Cloudinary -> redirect luôn
    if (song.file.startsWith("http")) {
      return res.redirect(song.file);
    }

    let filePath, fileSize;

    // 🚀 BƯỚC 1: KIỂM TRA BỘ NHỚ ĐỆM (CACHE)
    if (telegramCache.has(song.file) && telegramCache.get(song.file).expireAt > Date.now()) {
      const cached = telegramCache.get(song.file);
      filePath = cached.path;
      fileSize = cached.size;
    } else {
      // Gọi API Telegram xin link
      const getFileRes = await axios.get(
        `https://api.telegram.org/bot${process.env.TELE_BOT_TOKEN}/getFile?file_id=${song.file}`
      );
      filePath = getFileRes.data.result.file_path;
      fileSize = getFileRes.data.result.file_size;

      // Lưu Cache sống 50 phút
      telegramCache.set(song.file, {
        path: filePath,
        size: fileSize,
        expireAt: Date.now() + 50 * 60 * 1000 
      });
    }gỉ

    const downloadUrl = `https://api.telegram.org/file/bot${process.env.TELE_BOT_TOKEN}/${filePath}`;

    // 🚀 BƯỚC 2: XỬ LÝ TUA NHẠC (RANGE REQUEST)
    const range = req.headers.range;

    if (range) {
      // Trình duyệt đòi tua đến một đoạn cụ thể
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      // Cài đặt Header phản hồi 206 Partial Content (Bắt buộc để tua được)
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg',
      });

      // Mở luồng tải từ đúng vị trí start
      https.get(downloadUrl, { headers: { range: req.headers.range } }, (stream) => {
        stream.pipe(res);
      });

    } else {
      // Phát từ đầu (Không tua)
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes'
      });
      
      https.get(downloadUrl, (stream) => {
        stream.pipe(res);
      });
    }

  } catch (err) {
    console.error("Stream error:", err.message);
    res.status(500).json({ error: "Lỗi phát nhạc" });
  }
});

/* ================== GET LIST & CRUD ================== */
router.get("/category/:type", async (req, res) => {
  const songs = await Song.find({ category: req.params.type }).sort({ createdAt: -1 });
  res.json(songs);
});

router.get("/", async (req, res) => {
  const songs = await Song.find();
  res.json(songs);
});

/* ================== STATS & ACTION ================== */
// Tổng lượt nghe
router.get("/stats/total-listens", async (req, res) => {
  const result = await Song.aggregate([
    { $group: { _id: null, totalListens: { $sum: "$listens" } } },
  ]);
  res.json({ total: result[0]?.totalListens || 0 });
});

// Tăng lượt nghe
router.put("/:id/listen", async (req, res) => {
  const updated = await Song.findByIdAndUpdate(
    req.params.id,
    { $inc: { listens: 1 } },
    { new: true }
  );
  res.json(updated);
});

/* ================== CRUD (LUÔN ĐỂ CUỐI) ================== */
// Lấy chi tiết 1 bài
router.get("/:id", async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ error: "Không tìm thấy bài hát" });
    res.json(song);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cập nhật bài
router.put("/:id", async (req, res) => {
  try {
    const updatedSong = await Song.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedSong) {
      return res.status(404).json({ error: "Không tìm thấy bài hát" });
    }

    res.json({ message: "✅ Cập nhật thành công", data: updatedSong });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Xóa bài
router.delete("/:id", async (req, res) => {
  await Song.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

module.exports = router;