const { supabase } = require('./db');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const BUCKET_NAME = process.env.STORAGE_BUCKET || 'lecture-materials';
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Ensure local uploads directory exists as fallback
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Upload file buffer to Supabase Storage bucket (or local storage fallback)
 * @param {Object} file - Multer file object (buffer, originalname, mimetype)
 * @param {string} destinationFolder - Folder inside bucket (e.g., 'CSC/100L')
 * @returns {Object} { file_url, file_path }
 */
const uploadFileToStorage = async (file, destinationFolder = 'general') => {
  const fileExt = path.extname(file.originalname).toLowerCase();
  const timestamp = Date.now();
  const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
  const filePath = `${destinationFolder}/${timestamp}_${sanitizedFilename}`;

  try {
    // Attempt Supabase Storage Upload
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (error) {
      console.warn('Supabase Storage upload warning (falling back to local storage):', error.message);
      throw error;
    }

    // Retrieve public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return {
      file_url: publicUrlData.publicUrl,
      file_path: filePath
    };

  } catch (error) {
    // Fallback: Local File Storage
    const localFileName = `${timestamp}_${sanitizedFilename}`;
    const localFilePath = path.join(UPLOADS_DIR, localFileName);

    fs.writeFileSync(localFilePath, file.buffer);

    return {
      file_url: `/uploads/${localFileName}`,
      file_path: localFileName
    };
  }
};

/**
 * Delete file from Supabase Storage / Local Storage
 * @param {string} filePath - Supabase path or local filename
 */
const deleteFileFromStorage = async (filePath) => {
  try {
    if (filePath.startsWith('uploads/') || !filePath.includes('/')) {
      const localPath = path.join(UPLOADS_DIR, path.basename(filePath));
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    } else {
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
    }
  } catch (error) {
    console.error('Error deleting file from storage:', error.message);
  }
};

module.exports = {
  uploadFileToStorage,
  deleteFileFromStorage,
  BUCKET_NAME
};
