const express = require("express");
const cors = require("cors");
const path = require("path");

const { pool } = require("./config/db");

const authRoutes = require(
  "./routes/auth.routes",
);

const studentRoutes = require(
  "./routes/students.route",
);

const parentRoutes = require(
  "./routes/parents.route",
);

const teacherRoutes = require(
  "./routes/teachers.route",
);
const staffRoutes = require(
  "./routes/staff.routes",
);
const adminRoutes = require(
  "./routes/admin.routes",
);
const paymentRoutes = require(
  "./routes/payments.route",
);
const supervisorRoutes = require(
  "./routes/supervisor.route",
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

// Serve uploaded files (homework attachments, etc.)
app.use(
  "/uploads",
  express.static(path.resolve(__dirname, "../uploads")),
);

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Student Management API đang hoạt động",
  });
});

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      message: "Student Management API đang hoạt động",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check database error:", error.message);

    res.status(503).json({
      success: false,
      message: "API đang hoạt động nhưng không kết nối được database",
      database: "disconnected",
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/parents", parentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/supervisor", supervisorRoutes);

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