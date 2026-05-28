require('dotenv').config();
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const connectDB = require('./config/db');
const User = require('./models/User');
const { addUser, removeUserBySocket, getOnlineUsers } = require('./socketTracker');

// Initialize Express App
const app = express();
const server = http.createServer(app);

// Connect to Database
connectDB();

// Middlewares
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Setup Socket.io with CORS
const io = socketio(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Bind socketio instance to express app so it's accessible in controllers
app.set('socketio', io);

// Socket.io JWT Authentication Middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    socket.user = user;
    next();
  } catch (error) {
    console.error('Socket authentication error:', error.message);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.io Connection Logic
io.on('connection', async (socket) => {
  const userId = socket.user._id.toString();
  
  // Register connected user
  addUser(userId, socket.id);
  
  // Join private room named after the user's ID
  socket.join(userId);
  console.log(`User connected: ${socket.user.username} (${userId}) | Socket: ${socket.id}`);

  try {
    // Update status to online in database
    await User.findByIdAndUpdate(userId, { status: 'online' });
    
    // Broadcast status change to all clients
    io.emit('status_change', { userId, status: 'online' });
    
    // Send list of currently online users to the newly connected user
    socket.emit('get_online_users', getOnlineUsers());
  } catch (err) {
    console.error('Error handling user socket connection:', err);
  }

  // Handle joining a specific chat channel
  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
    console.log(`User ${socket.user.username} joined chat room: ${chatId}`);
  });

  // Handle typing status events in chat rooms
  socket.on('typing', ({ chatId }) => {
    socket.to(chatId).emit('typing_status', { chatId, senderId: userId, isTyping: true });
  });

  socket.on('stop_typing', ({ chatId }) => {
    socket.to(chatId).emit('typing_status', { chatId, senderId: userId, isTyping: false });
  });

  // Handle manual disconnect or connection timeout
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.user.username} (${userId})`);
    
    // Remove user mapping
    removeUserBySocket(socket.id);

    try {
      // Set database status to offline
      await User.findByIdAndUpdate(userId, { status: 'offline' });
      
      // Broadcast status change to everyone
      io.emit('status_change', { userId, status: 'offline' });
      
      // Broadcast active online list update
      io.emit('get_online_users', getOnlineUsers());
    } catch (err) {
      console.error('Error handling user socket disconnect:', err);
    }
  });
});

// Routes
const { handleGoogleCallback } = require('./controllers/auth');
app.get('/auth/google/callback', handleGoogleCallback);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/user'));
app.use('/api/messages', require('./routes/message'));
app.use('/api/chats', require('./routes/chat'));
app.use('/api/upload', require('./routes/upload'));

// Default route
app.get('/', (req, res) => {
  res.send('VibeChat API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'An internal server error occurred',
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running in mode on port ${PORT}`);
});
