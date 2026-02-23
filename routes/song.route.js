const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const Song = require("../models/Song");
const slugify = require("slugify");
const { webpush, getSubscriptions } = require("../push");

/* ================== UPLOAD CONFIG ================== */
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // giới hạn 20MB
}).single("file");


/* ================== UPLOAD ================== */
/* ================== CLOUDINARY STREAM ================== */

const streamUpload = (buffer, category) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video", // ⚠️ mp3 phải dùng video
        folder: `music/${category || "uncategorized"}`,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    stream.end(buffer);
  });
};

// Upload 1 bài
router.post("/upload", upload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "❌ Không có file được tải lên",
      });
    }

    const { title, artist, image, category } = req.body;

    const fileName = slugify(
      req.file.originalname.split(".")[0],
      {
        lower: true,
        strict: true,
      }
    );

    // ✅ Upload Cloudinary
    const result = await streamUpload(
      req.file.buffer,
      category,
      fileName
    );

    // ✅ Save DB
    const newSong = await Song.create({
      title,
      artist,
      image,
      file: result.secure_url,
      category,
      listens: 0,
    });

    // ✅ TRẢ RESPONSE NGAY
    res.status(201).json({
      message: "✅ Thêm bài hát thành công",
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
          webpush
            .sendNotification(sub, payload)
            .catch(console.error);
        }
      } catch (err) {
        console.error("Push error:", err);
      }
    });

  } catch (err) {
    console.error("❌ Upload failed:", err);
    return res.status(500).json({
      error: err.message,
    });
  }
});



/* ================== GET LIST ================== */

// Lấy theo category
router.get("/category/:type", async (req, res) => {
  const songs = await Song.find({ category: req.params.type }).sort({
    createdAt: -1,
  });
  res.json(songs);
});

// Lấy tất cả
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
