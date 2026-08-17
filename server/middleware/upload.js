const multer = require('multer');
const path = require('path');

// Store files in memory buffer for streaming directly to Supabase Storage
const storage = multer.memoryStorage();

// Allowed File Formats
const ALLOWED_EXTENSIONS = /pdf|doc|docx|ppt|pptx|zip|png|jpg|jpeg/;
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'image/png',
  'image/jpeg',
  'image/jpg'
];

/**
 * File filter validation function
 */
const fileFilter = (req, file, cb) => {
  const extname = ALLOWED_EXTENSIONS.test(path.extname(file.originalname).toLowerCase());
  const mimetype = ALLOWED_MIME_TYPES.includes(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type! Allowed formats: PDF, DOC, DOCX, PPT, PPTX, ZIP, PNG, JPG, JPEG.'));
  }
};

// Multer Upload Instance
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB Maximum File Size limit
  },
  fileFilter
});

module.exports = upload;
