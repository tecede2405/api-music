const multer = require("multer");

// Lưu file vào RAM (buffer)
const storage = multer.memoryStorage();

const uploadSingle = multer({ storage }).single("file");
const uploadMultiple = multer({ storage }).array("files", 20);

module.exports = { uploadSingle, uploadMultiple };