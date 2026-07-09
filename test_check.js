const fs = require("fs");
const results = [];

try {
  require("./config/database");
  results.push("✅ config/database OK");
} catch (e) {
  results.push("❌ config/database: " + e.message);
}

try {
  require("./repositories/song.repository");
  results.push("✅ repositories/song OK");
} catch (e) {
  results.push("❌ repositories/song: " + e.message);
}

try {
  require("./repositories/storage.repository");
  results.push("✅ repositories/storage OK");
} catch (e) {
  results.push("❌ repositories/storage: " + e.message);
}

try {
  require("./repositories/subscription.repository");
  results.push("✅ repositories/subscription OK");
} catch (e) {
  results.push("❌ repositories/subscription: " + e.message);
}

try {
  require("./services/song.service");
  results.push("✅ services/song OK");
} catch (e) {
  results.push("❌ services/song: " + e.message);
}

try {
  require("./services/storage.service");
  results.push("✅ services/storage OK");
} catch (e) {
  results.push("❌ services/storage: " + e.message);
}

try {
  require("./services/notification.service");
  results.push("✅ services/notification OK");
} catch (e) {
  results.push("❌ services/notification: " + e.message);
}

try {
  require("./services/chat.service");
  results.push("✅ services/chat OK");
} catch (e) {
  results.push("❌ services/chat: " + e.message);
}

try {
  require("./services/auth.service");
  results.push("✅ services/auth OK");
} catch (e) {
  results.push("❌ services/auth: " + e.message);
}

try {
  require("./controllers/song.controller");
  results.push("✅ controllers/song OK");
} catch (e) {
  results.push("❌ controllers/song: " + e.message);
}

try {
  require("./controllers/storage.controller");
  results.push("✅ controllers/storage OK");
} catch (e) {
  results.push("❌ controllers/storage: " + e.message);
}

try {
  require("./controllers/notification.controller");
  results.push("✅ controllers/notification OK");
} catch (e) {
  results.push("❌ controllers/notification: " + e.message);
}

try {
  require("./controllers/chat.controller");
  results.push("✅ controllers/chat OK");
} catch (e) {
  results.push("❌ controllers/chat: " + e.message);
}

try {
  require("./controllers/auth.controller");
  results.push("✅ controllers/auth OK");
} catch (e) {
  results.push("❌ controllers/auth: " + e.message);
}

try {
  require("./middlewares/upload.middleware");
  results.push("✅ middlewares/upload OK");
} catch (e) {
  results.push("❌ middlewares/upload: " + e.message);
}

try {
  require("./routes/index");
  results.push("✅ routes/index OK");
} catch (e) {
  results.push("❌ routes/index: " + e.message);
}

fs.writeFileSync("d:\\Api-music\\test_results.txt", results.join("\n"));
console.log("Done - check test_results.txt");