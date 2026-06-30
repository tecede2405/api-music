const express = require("express");
const router = express.Router();
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const https = require("https");
const sharp = require("sharp");
const Storage = require("../models/Storage");

const telegramCache = new Map();

const storage = multer.memoryStorage();
// Đổi cấu hình chấp nhận mảng files (Tối đa 20 file cùng lúc)
const uploadMultiple = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, 
}).array("files", 20); 

/* ================== 1. API UPLOAD MULTIPLE FILES ================== */
/* ================== 1. API UPLOAD MULTIPLE FILES ================== */
router.post("/upload", uploadMultiple, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "❌ Không có file nào được tải lên" });
    }

    const savedItems = [];

    // Hàm phụ dùng để loại bỏ dấu Tiếng Việt và ký tự đặc biệt để Telegram không bị lỗi Header
    const sanitizeFileName = (str) => {
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Xóa dấu
        .replace(/đ/g, "d").replace(/Đ/g, "D") // Sửa chữ đ
        .replace(/[^a-zA-Z0-9.\-_ ]/g, ""); // Xóa ký tự lạ ngoại trừ chữ, số, khoảng trắng, gạch ngang, chấm
    };

    // Duyệt và xử lý tuần tự từng file một
    for (const file of req.files) {
      let mimeType = file.mimetype;
      let isVideo = mimeType.startsWith("video/");
      let isImage = mimeType.startsWith("image/");

      // Bỏ qua file lạ không phải ảnh hoặc video
      if (!isVideo && !isImage) continue;

      let fileBuffer = file.buffer;
      let fileSize = file.size;
      
      // 🔥 GIẢI MÃ CHUỖI TÊN ĐÃ ĐƯỢC CHUYỂN ĐỔI TỪ FRONT-END
      let decodedOriginalName = "";
      try {
        decodedOriginalName = decodeURIComponent(file.originalname);
      } catch (decodeErr) {
        // Phòng hờ nếu file không có tên hoặc lỗi định dạng
        decodedOriginalName = file.originalname || (isVideo ? "video.mp4" : "image.jpg");
      }
      
      let dbStorageName = decodedOriginalName; // Tên hiển thị lưu trên MongoDB (Giữ nguyên Tiếng Việt)
      let telegramFileName = sanitizeFileName(decodedOriginalName); // Tên gửi sang Telegram (Sạch dấu để tránh lỗi)

      if (!telegramFileName) {
        telegramFileName = isVideo ? "video.mp4" : "image.jpg";
      }

      // Tự động nén thành WebP nếu là hình ảnh
      if (isImage) {
        mimeType = "image/webp";
        
        dbStorageName = dbStorageName.replace(/\.[^/.]+$/, "") + ".webp";
        telegramFileName = telegramFileName.replace(/\.[^/.]+$/, "") + ".webp";

        fileBuffer = await sharp(file.buffer)
          .webp({ quality: 80 })
          .toBuffer();

        fileSize = fileBuffer.length;
      }

      const form = new FormData();
      form.append("chat_id", process.env.TELE_CHAT_ID);

      let telegramUrl = "";
      if (isVideo) {
        telegramUrl = `https://api.telegram.org/bot${process.env.TELE_BOT_TOKEN}/sendVideo`;
        form.append("video", fileBuffer, { filename: telegramFileName, contentType: mimeType });
      } else {
        telegramUrl = `https://api.telegram.org/bot${process.env.TELE_BOT_TOKEN}/sendPhoto`;
        form.append("photo", fileBuffer, { filename: telegramFileName, contentType: mimeType });
      }

      // Đẩy dữ liệu qua Telegram Bot
      const teleRes = await axios.post(telegramUrl, form, { headers: form.getHeaders() });
      
      let fileId = "";
      if (isVideo) {
        fileId = teleRes.data.result.video.file_id;
      } else {
        const photos = teleRes.data.result.photo;
        fileId = photos[photos.length - 1].file_id;
      }

      // Lưu tài nguyên vào MongoDB database (Trường name luôn có dữ liệu tiếng Việt sạch đẹp)
      const newItem = await Storage.create({
        name: dbStorageName || "Untitled File",
        type: isVideo ? "video" : "image",
        fileId: fileId,
        size: fileSize
      });

      savedItems.push(newItem);
    }

    res.status(201).json({
      message: `✅ Đã lưu trữ thành công ${savedItems.length} tài nguyên`,
      data: savedItems
    });

  } catch (err) {
    // 🔥 In chi tiết lỗi ở terminal của backend để dễ kiểm tra nếu còn sót lỗi
    console.error("❌ Upload Storage Failed:", err.response ? err.response.data : err.stack || err.message);
    return res.status(500).json({ error: "Lỗi hệ thống khi xử lý upload kho lưu trữ" });
  }
});

/* ================== 2. API PHÁT/XEM FILE (STREAM & VIEW) ================== */
router.get("/file/:id", async (req, res) => {
  try {
    const item = await Storage.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Không tìm thấy file" });

    let filePath, fileSize;

    if (telegramCache.has(item.fileId) && telegramCache.get(item.fileId).expireAt > Date.now()) {
      const cached = telegramCache.get(item.fileId);
      filePath = cached.path;
      fileSize = cached.size;
    } else {
      const getFileRes = await axios.get(
        `https://api.telegram.org/bot${process.env.TELE_BOT_TOKEN}/getFile?file_id=${item.fileId}`
      );
      filePath = getFileRes.data.result.file_path;
      fileSize = getFileRes.data.result.file_size;

      telegramCache.set(item.fileId, {
        path: filePath,
        size: fileSize,
        expireAt: Date.now() + 50 * 60 * 1000
      });
    }

    const downloadUrl = `https://api.telegram.org/file/bot${process.env.TELE_BOT_TOKEN}/${filePath}`;
    const contentType = item.type === "video" ? "video/mp4" : "image/webp";

    const range = req.headers.range;
    if (range && item.type === "video") {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      });

      https.get(downloadUrl, { headers: { range: req.headers.range } }, (stream) => {
        stream.pipe(res);
      });
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });
      
      https.get(downloadUrl, (stream) => {
        stream.pipe(res);
      });
    }

  } catch (err) {
    console.error("Stream File Error:", err.message);
    res.status(500).json({ error: "Lỗi đọc dữ liệu" });
  }
});

/* ================== 3. API LẤY DANH SÁCH KHO LƯU TRỮ ================== */
router.get("/", async (req, res) => {
  try {
    const list = await Storage.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================== 4. API XÓA FILE ================== */
router.delete("/:id", async (req, res) => {
  try {
    await Storage.findByIdAndDelete(req.params.id);
    res.json({ message: "Đã xóa khỏi hệ thống dữ liệu" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;