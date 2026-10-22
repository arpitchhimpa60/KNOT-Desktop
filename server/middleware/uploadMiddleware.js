
const multer = require("multer");
const path = require("path");

// Block executable and potentially harmful script extensions.
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

// Store uploaded files in memory temporarily.
// The controllers will upload their buffers to Cloudinary.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

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
    }

    if (err) {
      return res.status(400).json({
        message: err.message || "Invalid file upload",
      });
    }

    next();
  });
};

module.exports = {
  handleFileUpload,
};
