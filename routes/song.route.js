const express = require("express");
const router = express.Router();
const songController = require("../controllers/song.controller");
const { uploadSingle } = require("../middlewares/upload.middleware");

// Upload bài hát
router.post("/upload", uploadSingle, songController.upload);

// Stream nhạc
router.get("/stream/:id", songController.stream);

// Lấy tất cả bài hát
router.get("/", songController.getAll);

// Lấy bài hát theo ID
router.get("/:id", songController.getById);

// Lấy bài hát theo category
router.get("/category/:category", songController.getByCategory);

// Cập nhật bài hát
router.put("/:id", songController.update);

// Tăng lượt nghe
router.patch("/:id/listen", songController.listen);

// Xóa bài hát
router.delete("/:id", songController.remove);

// Tổng lượt nghe
router.get("/stats/total-listens", songController.totalListens);

module.exports = router;