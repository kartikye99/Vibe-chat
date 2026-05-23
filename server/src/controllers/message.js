const Message = require('../models/Message');
const User = require('../models/User');
const { getSocketId } = require('../socketTracker');

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const { recipientId, content } = req.body;
    const senderId = req.user.id;

    if (!recipientId || !content) {
      return res.status(400).json({ message: 'Recipient and content are required' });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    // Create message in database
    const message = await Message.create({
      sender: senderId,
      recipient: recipientId,
      content,
    });

    // Populate sender details for the frontend
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username email avatar status')
      .populate('recipient', 'username email avatar status');

    // Socket.io real-time push: check if recipient is online
    const recipientSocketId = getSocketId(recipientId);
    const io = req.app.get('socketio'); // Retrieve io instance bound in server.js

    if (recipientSocketId && io) {
      io.to(recipientSocketId).emit('receive_message', populatedMessage);
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get messages between two users
// @route   GET /api/messages/:userId
// @access  Private
const getMessages = async (req, res) => {
  try {
    const myId = req.user.id;
    const chatPartnerId = req.params.userId;

    // Retrieve conversation history
    const messages = await Message.find({
      $or: [
        { sender: myId, recipient: chatPartnerId },
        { sender: chatPartnerId, recipient: myId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate('sender', 'username email avatar')
      .populate('recipient', 'username email avatar');

    // Update unread messages sent by the partner to "read"
    await Message.updateMany(
      { sender: chatPartnerId, recipient: myId, read: false },
      { $set: { read: true } }
    );

    // Notify the sender that their messages are read
    const partnerSocketId = getSocketId(chatPartnerId);
    const io = req.app.get('socketio');
    if (partnerSocketId && io) {
      io.to(partnerSocketId).emit('messages_read', { readerId: myId });
    }

    res.json(messages);
  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  sendMessage,
  getMessages,
};
