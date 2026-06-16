const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require(
  "./routes/auth.routes",
);

const studentRoutes = require(
  "./routes/students.route",
);

const parentRoutes = require(
  "./routes/parents.route",
);
const app = express();

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      "http://localhost:5173",

    credentials: true,
  }),
);

app.use(express.json());
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "KidCare API đang hoạt động",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/parents", parentRoutes);
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Không tìm thấy API",
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);

  res.status(500).json({
    success: false,
    message: "Lỗi máy chủ nội bộ",
  });
});

module.exports = app;