require("dotenv").config();

const app = require("./app");

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  console.log(
    `KidCare API đang lắng nghe tại http://127.0.0.1:${PORT}`,
  );
});

server.on("error", (error) => {
  console.error("Không thể khởi động server:", error);

  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} đang được sử dụng.`);
  }

  process.exit(1);
});