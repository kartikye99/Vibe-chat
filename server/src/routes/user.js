const express = require('express');
const { getUsers } = require('../controllers/user');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getUsers);

module.exports = router;
