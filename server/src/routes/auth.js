const express = require('express');
const {
  registerUser,
  loginUser,
  redirectToGoogle,
  handleGoogleCallback,
  getMe,
  updateProfile,
} = require('../controllers/auth');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/google', redirectToGoogle);
router.get('/google/callback', handleGoogleCallback);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

module.exports = router;
