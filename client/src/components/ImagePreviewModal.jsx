import { useState, useEffect } from "react";

function ImagePreviewModal({
  isOpen,
  onClose,
  src,
  alt = "Image Preview",
  fileName = "",
  fileSize = null,
  onDownload = null,
  downloading = false,
}) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Reset zoom and rotation whenever a new image is opened
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setRotation(0);
    }
  }, [isOpen, src]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

  function handleZoomIn() {
    setScale((prev) => Math.min(prev + 0.25, 3));
  }

  function handleZoomOut() {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  }

  function handleReset() {
    setScale(1);
    setRotation(0);
  }

  function handleRotate() {
    setRotation((prev) => (prev + 90) % 360);
  }

  return (
    <div
      className="image-preview-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image Preview Modal"
    >
      {/* Top Header Bar */}
      <div
        className="image-preview-header"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="image-preview-info">
          <span className="image-preview-filename" title={fileName || alt}>
            {fileName || alt}
          </span>
          {fileSize && (
            <span className="image-preview-filesize">{fileSize}</span>
          )}
        </div>

        <div className="image-preview-toolbar">
          <button
            type="button"
            className="image-preview-tool-btn"
            onClick={handleZoomIn}
            title="Zoom In"
            aria-label="Zoom in"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>

          <button
            type="button"
            className="image-preview-tool-btn"
            onClick={handleZoomOut}
            title="Zoom Out"
            aria-label="Zoom out"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>

          <button
            type="button"
            className="image-preview-tool-btn"
            onClick={handleRotate}
            title="Rotate 90°"
            aria-label="Rotate image"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>

          {(scale !== 1 || rotation !== 0) && (
            <button
              type="button"
              className="image-preview-tool-btn reset-btn"
              onClick={handleReset}
              title="Reset Zoom & Rotation"
              aria-label="Reset zoom and rotation"
            >
              Reset
            </button>
          )}

          {onDownload && (
            <button
              type="button"
              className="image-preview-tool-btn download-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              disabled={downloading}
              title="Download Image"
              aria-label="Download image"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{downloading ? "Saving..." : "Download"}</span>
            </button>
          )}

          <button
            type="button"
            className="image-preview-tool-btn close-btn"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close preview"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Image Body */}
      <div
        className="image-preview-body"
        onClick={(e) => {
          // If clicked directly on the empty background, close
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className="image-preview-stage"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: "transform 0.2s cubic-bezier(0.2, 0, 0, 1)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={src}
            alt={alt}
            className="image-preview-img"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}

export default ImagePreviewModal;
