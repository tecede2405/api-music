const songService = require("../services/song.service");

class SongController {
  async upload(req, res) {
    try {
      const { title, artist, image, category } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "Chưa chọn file nhạc" });
      }

      const newSong = await songService.uploadSong({ file, title, artist, image, category });
      res.status(201).json({ message: "Upload thành công", song: newSong });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "Upload thất bại", detail: err.message });
    }
  }

  async stream(req, res) {
    try {
      await songService.streamSong(req.params.id, req, res);
    } catch (err) {
      console.error("Stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Stream thất bại" });
      }
    }
  }

  async getAll(req, res) {
    try {
      const songs = await songService.getAllSongs();
      res.json(songs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getById(req, res) {
    try {
      const song = await songService.getSongById(req.params.id);
      if (!song) return res.status(404).json({ error: "Không tìm thấy" });
      res.json(song);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getByCategory(req, res) {
    try {
      const songs = await songService.getSongsByCategory(req.params.category);
      res.json(songs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async update(req, res) {
    try {
      const updated = await songService.updateSong(req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async listen(req, res) {
    try {
      const updated = await songService.incrementListens(req.params.id);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async remove(req, res) {
    try {
      await songService.deleteSong(req.params.id);
      res.json({ message: "Đã xóa bài hát" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async totalListens(req, res) {
    try {
      const total = await songService.getTotalListens();
      res.json({ totalListens: total });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new SongController();