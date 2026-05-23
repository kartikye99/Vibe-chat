const express = require('express');
const { sendMessage, getMessages } = require('../controllers/message');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, sendMessage);
router.get('/:userId', protect, getMessages);

module.exports = router;
