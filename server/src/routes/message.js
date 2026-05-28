const express = require('express');
const { sendMessage, getMessages, searchMessages } = require('../controllers/message');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, sendMessage);
router.get('/:chatId', protect, getMessages);
router.get('/:chatId/search', protect, searchMessages);

module.exports = router;
