const http = require("http");

const app = require("./app");
const { testConnection } = require("./config/db");
const { ensureValidPasswords } = require(
  "./services/password-setup.service",
);
const { initializeSocket } = require("./socket");
const announcementService = require("./services/announcement.service");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

async function startServer() {
  try {
    await testConnection();
    await ensureValidPasswords();

    const server = http.createServer(app);

    initializeSocket(server);

    const publishScheduledAnnouncements = async () => {
      try {
        await announcementService.publishDue();
      } catch (error) {
        console.error("Không thể phát hành thông báo đã lên lịch:", error);
      }
    };
    await publishScheduledAnnouncements();
    const announcementTimer = setInterval(publishScheduledAnnouncements, 60_000);
    announcementTimer.unref();

    server.listen(PORT, HOST, () => {
      console.log(
        `Student Management API và Socket.IO đang lắng nghe tại http://localhost:${PORT}`,
      );
    });

    server.on("error", (error) => {
      console.error("Không thể khởi động server:", error);

      if (error.code === "EADDRINUSE") {
        console.error(`Port ${PORT} đang được sử dụng.`);
      }

      process.exit(1);
    });
  } catch (error) {
    console.error("Không thể khởi động server:", error.message);
    process.exit(1);
  }
}

startServer();
