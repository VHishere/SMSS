const fs = require("fs");
const path = require("path");
const multer = require("multer");

const UPLOAD_ROOT = path.resolve(__dirname, "../../uploads");
const HOMEWORK_DIR = path.join(UPLOAD_ROOT, "homework");
const MESSAGE_DIR = path.join(UPLOAD_ROOT, "messages");
const EVENT_DIR = path.join(UPLOAD_ROOT, "events");

// Ensure the target directories exist at startup.
fs.mkdirSync(HOMEWORK_DIR, { recursive: true });
fs.mkdirSync(MESSAGE_DIR, { recursive: true });
fs.mkdirSync(EVENT_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "text/plain",
  "application/zip",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function makeStorage(targetDir) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, targetDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const base = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9-_]/g, "_")
        .slice(0, 60);
      const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
      cb(null, `${base}_${unique}${ext}`);
    },
  });
}

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error("Định dạng tệp không được hỗ trợ");
    err.statusCode = 400;
    cb(err);
  }
}

// Wrap a multer single-file handler into the project's JSON error shape.
function wrapSingle(uploader) {
  return (req, res, next) => {
    uploader(req, res, (err) => {
      if (err) {
        const status = err.code === "LIMIT_FILE_SIZE" ? 413 : err.statusCode || 400;
        const message =
          err.code === "LIMIT_FILE_SIZE"
            ? "Tệp vượt quá dung lượng tối đa 10MB"
            : err.message || "Tải tệp lên thất bại";
        return res.status(status).json({ success: false, message });
      }
      next();
    });
  };
}

const homeworkFileUpload = wrapSingle(
  multer({ storage: makeStorage(HOMEWORK_DIR), fileFilter, limits: { fileSize: MAX_FILE_SIZE } }).single("file"),
);

const messageFileUpload = wrapSingle(
  multer({ storage: makeStorage(MESSAGE_DIR), fileFilter, limits: { fileSize: MAX_FILE_SIZE } }).single("file"),
);

const eventFileUpload = wrapSingle(
  multer({ storage: makeStorage(EVENT_DIR), fileFilter, limits: { fileSize: MAX_FILE_SIZE } }).single("file"),
);

module.exports = { homeworkFileUpload, messageFileUpload, eventFileUpload, UPLOAD_ROOT };
