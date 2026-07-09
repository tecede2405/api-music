const axios = require("axios");
const FormData = require("form-data");
const https = require("https");
const songRepository = require("../repositories/song.repository");
const notificationService = require("./notification.service");

// Cache link Telegram trên RAM
const telegramCache = new Map();

class SongService {
  async uploadSong({ file, title, artist, image, category }) {
    // 1. Đóng gói file từ RAM (buffer) để gửi lên Telegram
    const form = new FormData();
    form.append("chat_id", process.env.TELE_CHAT_ID);
    form.append("audio", file.buffer, {
      filename: file.originalname || "audio.mp3",
      contentType: file.mimetype || "audio/mpeg",
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

    // 3. Lưu DB
    const newSong = await songRepository.create({
      title,
      artist,
      image,
      file: fileId,
      category,
      listens: 0,
    });

    // 4. Push notification background
    setImmediate(async () => {
      try {
        await notificationService.sendToAll({
          title: "🎵 Bài hát mới!",
          body: `Vừa thêm bài hát: ${newSong.title} - ${newSong.artist}`,
          icon: "/logo192.png",
        });
      } catch (err) {
        console.error("Push error:", err);
      }
    });

    return newSong;
  }

  async streamSong(id, req, res) {
    const song = await songRepository.findById(id);
    if (!song || !song.file) {
      return res.status(404).json({ error: "Không tìm thấy bài hát" });
    }

    // Tương thích ngược: Nếu bài này vẫn là link Cloudinary -> redirect luôn
    if (song.file.startsWith("http")) {
      return res.redirect(song.file);
    }

    let filePath, fileSize;

    // Kiểm tra cache
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
        expireAt: Date.now() + 50 * 60 * 1000,
      });
    }

    const downloadUrl = `https://api.telegram.org/file/bot${process.env.TELE_BOT_TOKEN}/${filePath}`;

    // Xử lý tua nhạc (Range Request)
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": "audio/mpeg",
      });

      const request = https.get(downloadUrl, { headers: { range: req.headers.range } }, (stream) => {
        stream.pipe(res);
        stream.on("error", () => { if (!res.destroyed) res.end(); });
      });
      request.on("error", (err) => {
        console.error("Stream download error:", err.message);
        if (!res.headersSent) res.status(500).json({ error: "Stream thất bại" });
        else if (!res.destroyed) res.end();
      });
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "audio/mpeg",
        "Accept-Ranges": "bytes",
      });

      const request = https.get(downloadUrl, (stream) => {
        stream.pipe(res);
        stream.on("error", () => { if (!res.destroyed) res.end(); });
      });
      request.on("error", (err) => {
        console.error("Stream download error:", err.message);
        if (!res.headersSent) res.status(500).json({ error: "Stream thất bại" });
        else if (!res.destroyed) res.end();
      });
    }
  }

  async getAllSongs() {
    return await songRepository.findAll();
  }

  async getSongById(id) {
    return await songRepository.findById(id);
  }

  async getSongsByCategory(category) {
    return await songRepository.findByCategory(category);
  }

  async updateSong(id, data) {
    return await songRepository.updateById(id, data);
  }

  async incrementListens(id) {
    return await songRepository.incrementListens(id);
  }

  async deleteSong(id) {
    return await songRepository.deleteById(id);
  }

  async getTotalListens() {
    return await songRepository.getTotalListens();
  }
}

module.exports = new SongService();