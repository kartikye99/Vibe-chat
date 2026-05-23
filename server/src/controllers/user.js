const User = require('../models/User');

// @desc    Get all users (except self)
// @route   GET /api/users
// @access  Private
const getUsers = async (req, res) => {
  try {
    const keyword = req.query.search
      ? {
          $and: [
            {
              $or: [
                { username: { $regex: req.query.search, $options: 'i' } },
                { email: { $regex: req.query.search, $options: 'i' } },
              ],
            },
            { _id: { $ne: req.user.id } },
          ],
        }
      : { _id: { $ne: req.user.id } };

    const users = await User.find(keyword).select('-password');
    res.json(users);
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getUsers };
