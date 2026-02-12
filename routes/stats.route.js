const router = require("express").Router();
const Visit = require("../models/VisitLog"); // ✅ chỉ dùng Visit

// 🔥 Danh sách lịch sử truy cập
router.get("/visits", async (req, res) => {
  try {
    const visits = await Visit.find()
      .sort({ visitedAt: -1 })
      .limit(100);

    res.json(visits);
  } catch (err) {
    res.status(500).json({ error: "Cannot fetch visits" });
  }
});



module.exports = router;
