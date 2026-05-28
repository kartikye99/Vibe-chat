const Chat = require('../models/Chat');
const User = require('../models/User');

// @desc    Access or create 1-to-1 chat
// @route   POST /api/chats
// @access  Private
const accessChat = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'UserId parameter not sent' });
    }

    // Check if a 1-to-1 chat already exists with this user
    let isChat = await Chat.find({
      isGroupChat: false,
      users: { $size: 2, $all: [req.user.id, userId] },
    })
      .populate('users', '-password')
      .populate('latestMessage');

    isChat = await User.populate(isChat, {
      path: 'latestMessage.sender',
      select: 'username email avatar status',
    });

    if (isChat.length > 0) {
      res.json(isChat[0]);
    } else {
      // Create a new 1-to-1 chat
      const chatData = {
        chatName: 'sender',
        isGroupChat: false,
        users: [req.user.id, userId],
      };

      const createdChat = await Chat.create(chatData);
      const fullChat = await Chat.findById(createdChat._id).populate('users', '-password');
      res.status(201).json(fullChat);
    }
  } catch (error) {
    console.error('Access chat error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all chats for logged-in user
// @route   GET /api/chats
// @access  Private
const fetchChats = async (req, res) => {
  try {
    let chats = await Chat.find({ users: { $elemMatch: { $eq: req.user.id } } })
      .populate('users', '-password')
      .populate('groupAdmin', '-password')
      .populate('latestMessage')
      .sort({ updatedAt: -1 });

    chats = await User.populate(chats, {
      path: 'latestMessage.sender',
      select: 'username email avatar status',
    });

    res.json(chats);
  } catch (error) {
    console.error('Fetch chats error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a group chat
// @route   POST /api/chats/group
// @access  Private
const createGroupChat = async (req, res) => {
  try {
    const { name, users: userIds } = req.body;

    if (!name || !userIds) {
      return res.status(400).json({ message: 'Please enter group name and select users' });
    }

    let parsedUsers = typeof userIds === 'string' ? JSON.parse(userIds) : userIds;

    if (parsedUsers.length < 2) {
      return res.status(400).json({ message: 'At least 2 other users are required to form a group chat' });
    }

    // Add current user to group
    parsedUsers.push(req.user.id);

    const groupChat = await Chat.create({
      chatName: name,
      users: parsedUsers,
      isGroupChat: true,
      groupAdmin: req.user.id,
    });

    const fullGroupChat = await Chat.findById(groupChat._id)
      .populate('users', '-password')
      .populate('groupAdmin', '-password');

    res.status(201).json(fullGroupChat);
  } catch (error) {
    console.error('Create group chat error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Rename a group chat
// @route   PUT /api/chats/group/rename
// @access  Private
const renameGroup = async (req, res) => {
  try {
    const { chatId, chatName } = req.body;

    if (!chatId || !chatName) {
      return res.status(400).json({ message: 'ChatId and new group name are required' });
    }

    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { chatName },
      { new: true }
    )
      .populate('users', '-password')
      .populate('groupAdmin', '-password');

    if (!updatedChat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    res.json(updatedChat);
  } catch (error) {
    console.error('Rename group error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a user to a group chat
// @route   PUT /api/chats/group/add
// @access  Private
const addToGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
      return res.status(400).json({ message: 'ChatId and UserId are required' });
    }

    const added = await Chat.findByIdAndUpdate(
      chatId,
      { $addToSet: { users: userId } }, // $addToSet prevents adding duplicate users
      { new: true }
    )
      .populate('users', '-password')
      .populate('groupAdmin', '-password');

    if (!added) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    res.json(added);
  } catch (error) {
    console.error('Add user to group error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove a user from a group / leave group
// @route   PUT /api/chats/group/remove
// @access  Private
const removeFromGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
      return res.status(400).json({ message: 'ChatId and UserId are required' });
    }

    const removed = await Chat.findByIdAndUpdate(
      chatId,
      { $pull: { users: userId } },
      { new: true }
    )
      .populate('users', '-password')
      .populate('groupAdmin', '-password');

    if (!removed) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    res.json(removed);
  } catch (error) {
    console.error('Remove user from group error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  accessChat,
  fetchChats,
  createGroupChat,
  renameGroup,
  addToGroup,
  removeFromGroup,
};
