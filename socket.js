const { Server } = require("socket.io");
const OnlineUser = require("./models/OnlineUser");

let io;

module.exports = {
  init: (httpServer) => {
    io = new Server(httpServer, {
      cors: {
        origin: [
          "http://localhost:3000",
          "http://localhost:3001",
          "https://tecede.vercel.app",
          "https://tecede.netlify.app",
        ],
        credentials: true,
      },
    });

    io.on("connection", (socket) => {
      const ip =
        socket.handshake.headers["x-forwarded-for"]?.split(",")[0] ||
        socket.handshake.address;

      console.log("🟢 Socket connected:", socket.id, "IP:", ip);

      socket.on("user:online", async ({ visitorId, page }) => {
        await OnlineUser.findOneAndUpdate(
          { visitorId },
          {
            visitorId,
            page,
            ip,
            socketId: socket.id,
            lastActive: new Date(),
          },
          { upsert: true }
        );

        emitOnlineUsers();
      });

      socket.on("disconnect", async () => {
        console.log("🔴 Socket disconnected:", socket.id);
        await OnlineUser.findOneAndDelete({ socketId: socket.id });
        emitOnlineUsers();
      });
    });
  },
};

async function emitOnlineUsers() {
  const users = await OnlineUser.find().select(
    "-_id visitorId ip page lastActive"
  );
  io.emit("online:list", users);
}
