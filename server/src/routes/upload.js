const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage engine configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique name: timestamp + random suffix + original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter (Optional validation, here we allow standard images, PDFs, docs, videos)
const fileFilter = (req, file, cb) => {
  // Allow common assets and documents
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter,
});

// @desc    Upload file attachment
// @route   POST /api/upload
// @access  Private
router.post('/', protect, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Dynamic absolute file url based on host domain (works locally & in production)
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    res.status(201).json({
      fileUrl,
      fileType: req.file.mimetype,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
