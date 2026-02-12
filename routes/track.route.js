const express = require("express");
const router = express.Router(); // ✅ BẮT BUỘC
const UAParser = require("ua-parser-js");
const VisitLog = require("../models/VisitLog");

// 🔥 Track visit
router.post("/", async (req, res) => {
  try {
   const ip = req.ip;

    const ua = req.headers["user-agent"];
    const parser = new UAParser(ua);
    const result = parser.getResult();

    const { visitorId, page } = req.body;

    await VisitLog.create({
      ip,
      visitorId,
      page,
      device: result.device.type || "desktop",
      os: result.os.name,
      browser: result.browser.name,
      visitedAt: new Date(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Track visit error:", err);
    res.status(500).json({ error: "Track visit failed" });
  }
});

module.exports = router;
