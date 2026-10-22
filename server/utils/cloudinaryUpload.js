
const cloudinary = require("../config/cloudinary");

function uploadToCloudinary(file, folder) {
  return new Promise((resolve, reject) => {
    if (!file?.buffer) {
      return reject(new Error("No file buffer provided for upload"));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `knot/${folder}`,
        resource_type: "auto",
        type: "authenticated",
        use_filename: false,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        if (!result) {
          return reject(new Error("Cloudinary returned no upload result"));
        }

        resolve({
          publicId: result.public_id,
          secureUrl: result.secure_url,
          resourceType: result.resource_type,
          format: result.format || null,
          bytes: result.bytes,
        });
      }
    );

    uploadStream.end(file.buffer);
  });
}

function getAuthenticatedAssetUrl({
  publicId,
  resourceType = "image",
  format,
  expiresAt,
}) {
  if (!publicId) {
    throw new Error("Cloudinary public ID is required");
  }

  if (!expiresAt || expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new Error("A future expiry timestamp is required");
  }

  return cloudinary.utils.private_download_url(publicId, format || "", {
    resource_type: resourceType,
    type: "authenticated",
    attachment: false,
    expires_at: expiresAt,
  });
}

module.exports = {
  uploadToCloudinary,
  getAuthenticatedAssetUrl,
};
