const express = require("express");
const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    // Giả sử thành công → sau này có thể trả token
    return res.json({ message: "Đăng nhập thành công" });
  }

  res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu" });
});

module.exports = router;