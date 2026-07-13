const axios = require("axios");
const FormData = require("form-data");
const https = require("https");
const sharp = require("sharp");
const storageRepository = require("../repositories/storage.repository");

// Cache link Telegram trên RAM
const telegramCache = new Map();

// Hàm loại bỏ dấu Tiếng Việt và ký tự đặc biệt
const sanitizeFileName = (str) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9.\-_ ]/g, "");
};

class StorageService {
  async uploadMultipleFiles(files) {
    const savedItems = [];

    for (const file of files) {
      let mimeType = file.mimetype;
      let isVideo = mimeType.startsWith("video/");
      let isImage = mimeType.startsWith("image/");

      // Bỏ qua file lạ không phải ảnh hoặc video
      if (!isVideo && !isImage) continue;

      let fileBuffer = file.buffer;
      let fileSize = file.size;

      // Giải mã chuỗi tên đã được chuyển đổi từ front-end
      let decodedOriginalName = "";
      try {
        decodedOriginalName = decodeURIComponent(file.originalname);
      } catch (decodeErr) {
        decodedOriginalName = file.originalname || (isVideo ? "video.mp4" : "image.jpg");
      }

      let dbStorageName = decodedOriginalName;
      let telegramFileName = sanitizeFileName(decodedOriginalName);

      if (!telegramFileName) {
        telegramFileName = isVideo ? "video.mp4" : "image.jpg";
      }

      let newItem;

      if (isImage) {
        // Nén ảnh thành WebP
        mimeType = "image/webp";
        dbStorageName = dbStorageName.replace(/\.[^/.]+$/, "") + ".webp";
        const imageName = sanitizeFileName(dbStorageName.replace(/\.[^/.]+$/, ""));

        fileBuffer = await sharp(file.buffer).webp({ quality: 80 }).toBuffer();
        fileSize = fileBuffer.length;

        // Upload lên ImgBB qua base64
        const base64Image = fileBuffer.toString("base64");
        const imgbbForm = new FormData();
        imgbbForm.append("key", process.env.IMGBB_API_KEY);
        imgbbForm.append("image", base64Image);
        if (imageName) imgbbForm.append("name", imageName);

        const imgbbRes = await axios.post(
          "https://api.imgbb.com/1/upload",
          imgbbForm,
          { headers: imgbbForm.getHeaders() }
        );

        if (!imgbbRes.data.success) {
          throw new Error("ImgBB upload thất bại: " + JSON.stringify(imgbbRes.data));
        }

        const imgbbData = imgbbRes.data.data;

        // Lưu vào MongoDB với url ImgBB
        newItem = await storageRepository.create({
          name: dbStorageName || "Untitled File",
          type: "image",
          fileId: imgbbData.id,
          url: imgbbData.display_url,
          size: fileSize,
        });
      } else {
        // Video: giữ nguyên Telegram
        const form = new FormData();
        form.append("chat_id", process.env.TELE_CHAT_ID);
        form.append("video", fileBuffer, { filename: telegramFileName, contentType: mimeType });

        const telegramUrl = `https://api.telegram.org/bot${process.env.TELE_BOT_TOKEN}/sendVideo`;
        const teleRes = await axios.post(telegramUrl, form, { headers: form.getHeaders() });
        const fileId = teleRes.data.result.video.file_id;

        newItem = await storageRepository.create({
          name: dbStorageName || "Untitled File",
          type: "video",
          fileId: fileId,
          size: fileSize,
        });
      }

      savedItems.push(newItem);
    }

    return savedItems;
  }

  async streamFile(id, req, res) {
    const item = await storageRepository.findById(id);
    if (!item) return res.status(404).json({ error: "Không tìm thấy file" });

    // Ảnh có URL ImgBB → redirect thẳng
    if (item.type === "image" && item.url) {
      return res.redirect(item.url);
    }

    // Ảnh cũ (url null) hoặc video → stream qua Telegram như cũ
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
        expireAt: Date.now() + 50 * 60 * 1000,
      });
    }

    const downloadUrl = `https://api.telegram.org/file/bot${process.env.TELE_BOT_TOKEN}/${filePath}`;
    const contentType = item.type === "video" ? "video/mp4" : "image/webp";

    const range = req.headers.range;
    if (range && item.type === "video") {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": contentType,
      });

      const request = https.get(downloadUrl, { headers: { range: req.headers.range } }, (stream) => {
        stream.pipe(res);
        stream.on("error", () => { if (!res.destroyed) res.end(); });
      });
      request.on("error", (err) => {
        console.error("Storage stream error:", err.message);
        if (!res.headersSent) res.status(500).json({ error: "Stream thất bại" });
        else if (!res.destroyed) res.end();
      });
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
      });

      const request = https.get(downloadUrl, (stream) => {
        stream.pipe(res);
        stream.on("error", () => { if (!res.destroyed) res.end(); });
      });
      request.on("error", (err) => {
        console.error("Storage stream error:", err.message);
        if (!res.headersSent) res.status(500).json({ error: "Stream thất bại" });
        else if (!res.destroyed) res.end();
      });
    }
  }

  async getAllFiles() {
    return await storageRepository.findAll();
  }

  async deleteFile(id) {
    return await storageRepository.deleteById(id);
  }
}

module.exports = new StorageService();