const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
    });
    console.log("✅ MongoDB connected!");
  } catch (err) {
    console.error("❌ MongoDB connect failed:", err);
    process.exit(1);
  }
};

module.exports = connectDB;