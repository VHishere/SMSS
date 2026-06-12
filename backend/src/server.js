require("dotenv").config();

const app = require("./app");
const {
  testConnection,
} = require("./config/db");

const PORT =
  Number(process.env.PORT) || 3000;

const HOST =
  process.env.HOST || "0.0.0.0";

async function startServer() {
  try {
    await testConnection();

    const server = app.listen(
      PORT,
      HOST,
      () => {
        console.log(
          `KidCare API đang lắng nghe tại http://localhost:${PORT}`,
        );
      },
    );

    server.on("error", (error) => {
      console.error(
        "Không thể khởi động server:",
        error,
      );

      if (error.code === "EADDRINUSE") {
        console.error(
          `Port ${PORT} đang được sử dụng.`,
        );
      }

      process.exit(1);
    });
  } catch (error) {
    console.error(
      "Không thể kết nối MySQL:",
      error.message,
    );

    process.exit(1);
  }
}

startServer();