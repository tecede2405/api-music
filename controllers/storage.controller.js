const storageService = require("../services/storage.service");

class StorageController {
  async upload(req, res) {
    try {
      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "Chưa chọn file" });
      }

      const savedItems = await storageService.uploadMultipleFiles(files);
      res.json(savedItems);
    } catch (err) {
      console.error("Storage upload error:", err);
      res.status(500).json({ error: "Upload thất bại", detail: err.message });
    }
  }

  async stream(req, res) {
    try {
      await storageService.streamFile(req.params.id, req, res);
    } catch (err) {
      console.error("Storage stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Stream thất bại" });
      }
    }
  }

  async getAll(req, res) {
    try {
      const files = await storageService.getAllFiles();
      res.json(files);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async remove(req, res) {
    try {
      const deleted = await storageService.deleteFile(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Không tìm thấy file" });
      res.json({ message: "Đã xóa file" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new StorageController();