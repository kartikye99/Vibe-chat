const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');

// @desc    Send a message (1-to-1 or group)
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const { chatId, content, fileUrl, fileType } = req.body;
    const senderId = req.user.id;

    if (!chatId) {
      return res.status(400).json({ message: 'ChatId parameter is required' });
    }

    if (!content && !fileUrl) {
      return res.status(400).json({ message: 'Cannot send an empty message' });
    }

    // Check if chat exists
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    // Create the message
    const message = await Message.create({
      sender: senderId,
      content: content || '',
      chat: chatId,
      fileUrl: fileUrl || '',
      fileType: fileType || '',
      readBy: [senderId], // Sender has read their own message
    });

    // Update latest message in the Chat
    await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });

    // Populate full details for the response
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username email avatar status')
      .populate('chat');

    // Populate users inside the chat room
    const fullMessage = await User.populate(populatedMessage, {
      path: 'chat.users',
      select: 'username email avatar status',
    });

    // Socket.io push: Broadcast message to the room channel
    const io = req.app.get('socketio');
    if (io) {
      // Emit receive_message to everyone in the room (including sender, or exclude sender)
      // Standard: emit to the room (clients ignore if they are sender, or we emit to others)
      io.to(chatId).emit('receive_message', fullMessage);
      
      // Emit update_chat_list to all room users to refresh their sidebar ordering/badges
      chat.users.forEach((userId) => {
        io.to(userId.toString()).emit('update_chat_list', fullMessage);
      });
    }

    res.status(201).json(fullMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all messages inside a chat room
// @route   GET /api/messages/:chatId
// @access  Private
const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const myId = req.user.id;

    // Check if chat exists and user is part of it
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    const isMember = chat.users.some((userId) => userId.toString() === myId);
    if (!isMember) {
      return res.status(403).json({ message: 'You are not a member of this chat' });
    }

    // Fetch messages
    const messages = await Message.find({ chat: chatId })
      .populate('sender', 'username email avatar status')
      .populate('chat');

    // Add user to readBy array for all messages they haven't read yet
    await Message.updateMany(
      { chat: chatId, readBy: { $ne: myId } },
      { $addToSet: { readBy: myId } }
    );

    // Notify other users in the room that messages were read
    const io = req.app.get('socketio');
    if (io) {
      io.to(chatId).emit('messages_read', { chatId, readerId: myId });
    }

    res.json(messages);
  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search messages in a chat room
// @route   GET /api/messages/:chatId/search
// @access  Private
const searchMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { query } = req.query;
    const myId = req.user.id;

    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // Check member permissions
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    const isMember = chat.users.some((userId) => userId.toString() === myId);
    if (!isMember) {
      return res.status(403).json({ message: 'You are not a member of this chat' });
    }

    // Search messages
    const matchedMessages = await Message.find({
      chat: chatId,
      content: { $regex: query, $options: 'i' },
    })
      .populate('sender', 'username email avatar status')
      .sort({ createdAt: -1 });

    res.json(matchedMessages);
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  sendMessage,
  getMessages,
  searchMessages,
};
