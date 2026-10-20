const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Ensure upload directory exists
const UPLOADS_DIR = path.join(__dirname, "../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Block executable and potentially harmful script extensions
const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".bash",
  ".app",
  ".vbs",
  ".scr",
  ".jar",
  ".com",
  ".pif",
  ".hta",
  ".cpl",
  ".msc",
  ".ps1",
  ".gadget",
  ".msi",
  ".dll",
  ".so",
  ".dylib",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const sanitizedExt = ext.replace(/[^a-z0-9.]/gi, "");
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    const safeFileName = `attachment-${uniqueSuffix}${sanitizedExt || ".dat"}`;
    cb(null, safeFileName);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return cb(
      new Error(
        `Files with '${ext}' extension are blocked for security reasons.`
      )
    );
  }
  cb(null, true);
};

// 10 MB file size limit
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// Middleware wrapper that returns friendly JSON errors
const handleFileUpload = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "File exceeds the 10 MB size limit",
        });
      }
      return res.status(400).json({
        message: err.message || "File upload error",
      });
    } else if (err) {
      return res.status(400).json({
        message: err.message || "Invalid file upload",
      });
    }
    next();
  });
};

module.exports = {
  handleFileUpload,
  UPLOADS_DIR,
};
