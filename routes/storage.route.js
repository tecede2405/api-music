const express = require("express");
const router = express.Router();
const storageController = require("../controllers/storage.controller");
const { uploadMultiple } = require("../middlewares/upload.middleware");

// Upload nhiều file (ảnh/video)
router.post("/upload", uploadMultiple, storageController.upload);

// Stream file theo ID
router.get("/stream/:id", storageController.stream);

// Lấy tất cả file
router.get("/", storageController.getAll);

// Xóa file
router.delete("/:id", storageController.remove);

module.exports = router;