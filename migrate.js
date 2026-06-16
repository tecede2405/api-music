require("dotenv").config();
const mongoose = require("mongoose");
const axios = require("axios");
const FormData = require("form-data");
const Song = require("./models/Song"); // Đảm bảo đường dẫn này đúng với thư mục dự án của bạn

const BOT_TOKEN = process.env.TELE_BOT_TOKEN;
const CHAT_ID = process.env.TELE_CHAT_ID;
// Chuỗi kết nối MongoDB Atlas của bạn đã được cấu hình sẵn
const MONGO_URI = "mongodb+srv://thoaixd123:fSxVwuUF8YSwD9k8@cluster0.kc72qw0.mongodb.net/music_db?retryWrites=true&w=majority&appName=Cluster0"; 

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function startMigration() {
  try {
    // --- BƯỚC 1: KIỂM TRA BIẾN MÔI TRƯỜNG TỪ FILE .ENV ---
    console.log("========== KIỂM TRA BIẾN ENV ==========");
    console.log(`TELE_BOT_TOKEN: ${BOT_TOKEN ? `✅ Đã nhận (Độ dài: ${BOT_TOKEN.length} ký tự)` : "❌ CHƯA NHẬN ĐƯỢC (BỊ TRỐNG)"}`);
    console.log(`TELE_CHAT_ID:   ${CHAT_ID ? `✅ Đã nhận (Giá trị: ${CHAT_ID})` : "❌ CHƯA NHẬN ĐƯỢC (BỊ TRỐNG)"}`);
    console.log("=======================================\n");

    if (!BOT_TOKEN || !CHAT_ID) {
      console.error("❌ DỪNG LẠI: File .env cấu hình sai hoặc đặt sai tên biến! Hãy kiểm tra lại file .env.");
      process.exit(1);
    }

    console.log("⏳ Đang kết nối tới MongoDB Atlas...");
    await mongoose.connect(MONGO_URI);
    console.log("🔌 Kết nối cơ sở dữ liệu thành công.");

    // Quét danh sách bài hát có trường 'file' chứa link Cloudinary (bắt đầu bằng http)
    const songsToMigrate = await Song.find({
      file: { $regex: "^http" } 
    });

    console.log(`🎵 Tìm thấy ${songsToMigrate.length} bài hát cần di cư sang Telegram.`);
    
    if (songsToMigrate.length === 0) {
      console.log("✅ Không có bài hát nào cần di cư hoặc toàn bộ hệ thống đã được chuyển đổi xong!");
      process.exit(0);
    }

    let successCount = 0;

    // --- BƯỚC 2: VÒNG LẶP DI CƯ DỮ LIỆU ---
    for (let i = 0; i < songsToMigrate.length; i++) {
      const song = songsToMigrate[i];
      console.log(`\n--------------------------------------------`);
      console.log(`⏳ [${i + 1}/${songsToMigrate.length}] Đang xử lý: "${song.title}"`);

      try {
        // 1. Tải trọn vẹn file nhạc từ Cloudinary vào bộ nhớ đệm (RAM)
        console.log(`   👉 Bước 1: Đang tải bài hát từ Cloudinary vào RAM...`);
        const cloudResponse = await axios({
          method: "get",
          url: song.file,
          responseType: "arraybuffer", // Sử dụng arraybuffer để ôm trọn file vào RAM
          timeout: 60000 // Đợi tối đa 1 phút để tải file nhạc
        });
        console.log(`   ✅ Tải hoàn tất. Kích thước: ${(cloudResponse.data.length / 1024 / 1024).toFixed(2)} MB`);

        // 2. Đóng gói dữ liệu dạng Buffer để gửi sang Telegram
        console.log(`   👉 Bước 2: Đang chuẩn bị form dữ liệu...`);
        const form = new FormData();
        form.append("chat_id", CHAT_ID);
        form.append("audio", Buffer.from(cloudResponse.data), { 
          filename: `${song.title || "audio"}.mp3`,
          contentType: "audio/mpeg"
        });
        form.append("title", song.title || "Unknown");
        form.append("performer", song.artist || "Unknown");

        // 🔥 SỬA LỖI TREO: Lấy header chuẩn và ép thêm Content-Length thực tế của file vào
        const headers = form.getHeaders();
        headers['Content-Length'] = form.getLengthSync(); 

        // 3. Đẩy file trực tiếp từ RAM lên Telegram API
        console.log(`   👉 Bước 3: Đang đẩy file lên Telegram (Dung lượng thực tế: ${(headers['Content-Length']/1024/1024).toFixed(2)} MB)...`);
        const teleRes = await axios.post(
          `https://api.telegram.org/bot${BOT_TOKEN}/sendAudio`,
          form,
          { 
              headers: headers, // Dùng bộ headers mới có độ dài file cụ thể
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
              timeout: 60000 // Đợi tối đa 60 giây. Nếu mạng lỗi sẽ báo ngay lập tức để chạy bài tiếp theo
          }
        );

        // 4. Nhận file_id và cập nhật lại MongoDB
        console.log(`   👉 Bước 4: Đang ghi nhận file_id mới vào MongoDB...`);
        song.file = teleRes.data.result.audio.file_id;
        await song.save();

        successCount++;
        console.log(`   ✅ Thành công bài: ${song.title}`);

      } catch (err) {
        console.error(`   ❌ Thất bại bài ${song.title}:`, err.message);
        // Nếu Telegram hoặc DB trả về lỗi chi tiết, đoạn này sẽ in sạch ra để xử lý
        if (err.response && err.response.data) {
          console.error(`      Chi tiết lỗi hệ thống:`, JSON.stringify(err.response.data));
        }
      }

      // Nghỉ 3 giây giữa các bài để tránh thuật toán Anti-Spam của Telegram khóa Bot
      console.log('💤 Chờ 3 giây để giãn cách tiến độ...');
      await sleep(3000);
    }

    console.log(`\n============================================`);
    console.log(`🎉 QUÁ TRÌNH DI CƯ HOÀN TẤT!`);
    console.log(`📊 Đã chuyển đổi thành công: ${successCount}/${songsToMigrate.length} bài.`);
    process.exit(0);

  } catch (err) {
    console.error("❌ Lỗi hệ thống nghiêm trọng khiến tiến trình bị dừng:", err.message);
    process.exit(1);
  }
}

// Khởi chạy script di cư
startMigration();