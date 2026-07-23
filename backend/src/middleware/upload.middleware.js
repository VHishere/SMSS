const { Readable } = require("stream");
const multer = require("multer");
const cloudinary = require("../config/cloudinary");

const storage = multer.memoryStorage();

const BASE_FOLDER = process.env.CLOUDINARY_FOLDER || "fpt-school";

const IMAGE_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

const VIDEO_MIMES = [
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/x-matroska",
];

const FILE_MIMES = [
  ...IMAGE_MIMES,
  ...VIDEO_MIMES,

  "application/pdf",
  "application/octet-stream",

  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/x-7z-compressed",

  "text/plain",
  "text/csv",
];

function uploadBufferToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      },
    );

    Readable.from(buffer).pipe(uploadStream);
  });
}

function createCloudinaryUpload({
  fieldName = "file",
  folder = "uploads",
  allowedMimes = FILE_MIMES,
  maxSizeMB = 20,
  resourceType = "auto",
}) {
  const upload = multer({
    storage,
    limits: {
      fileSize: maxSizeMB * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
      if (!allowedMimes.includes(file.mimetype)) {
        cb(new Error("Định dạng file không được hỗ trợ"));
        return;
      }

      cb(null, true);
    },
  }).single(fieldName);

  return (req, res, next) => {
    upload(req, res, async (uploadError) => {
      if (uploadError) {
        return res.status(400).json({
          success: false,
          message: uploadError.message || "Upload file thất bại",
        });
      }

      if (!req.file) {
        return next();
      }

      try {
        const result = await uploadBufferToCloudinary(req.file.buffer, {
          folder: `${BASE_FOLDER}/${folder}`,
          resource_type: resourceType,
          use_filename: true,
          unique_filename: true,
          overwrite: false,
        });

        req.file.cloudinaryUrl = result.secure_url;
        req.file.cloudinaryPublicId = result.public_id;
        req.file.cloudinaryResourceType = result.resource_type;
        req.file.cloudinaryFormat = result.format;
        req.file.cloudinaryBytes = result.bytes;

        delete req.file.buffer;

        return next();
      } catch (error) {
        console.error("Cloudinary upload error:", error);

        return res.status(500).json({
          success: false,
          message: "Không thể upload file lên Cloudinary",
        });
      }
    });
  };
}

const profileAvatarUpload = createCloudinaryUpload({
  fieldName: "avatar",
  folder: "avatars",
  allowedMimes: IMAGE_MIMES,
  maxSizeMB: 5,
  resourceType: "image",
});

const homeworkFileUpload = createCloudinaryUpload({
  fieldName: "file",
  folder: "homework",
  allowedMimes: FILE_MIMES,
  maxSizeMB: 50,
  resourceType: "auto",
});

const messageFileUpload = createCloudinaryUpload({
  fieldName: "file",
  folder: "messages",
  allowedMimes: FILE_MIMES,
  maxSizeMB: 50,
  resourceType: "auto",
});

const eventFileUpload = createCloudinaryUpload({
  fieldName: "file",
  folder: "events",
  allowedMimes: FILE_MIMES,
  maxSizeMB: 50,
  resourceType: "auto",
});

const handleUpload = createCloudinaryUpload({
  fieldName: "attachment",
  folder: "leave-requests",
  allowedMimes: FILE_MIMES,
  maxSizeMB: 20,
  resourceType: "auto",
});

module.exports = {
  profileAvatarUpload,
  homeworkFileUpload,
  messageFileUpload,
  eventFileUpload,
  handleUpload,
};