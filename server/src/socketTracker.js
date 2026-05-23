// Simple in-memory map to associate user IDs with active Socket IDs
const activeUsers = new Map(); // Key: userId (string), Value: socketId (string)

const getSocketId = (userId) => {
  return activeUsers.get(userId.toString());
};

const addUser = (userId, socketId) => {
  activeUsers.set(userId.toString(), socketId);
};

const removeUserBySocket = (socketId) => {
  for (let [userId, sId] of activeUsers.entries()) {
    if (sId === socketId) {
      activeUsers.delete(userId);
      return userId;
    }
  }
  return null;
};

const getOnlineUsers = () => {
  return Array.from(activeUsers.keys());
};

module.exports = {
  activeUsers,
  getSocketId,
  addUser,
  removeUserBySocket,
  getOnlineUsers,
};
