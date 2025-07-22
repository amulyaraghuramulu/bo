// server.js
const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const socket = require('socket.io');
const io = socket(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Enable CORS for Express
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

const rooms = {};

io.on('connection', socket => {
  console.log('New client connected:', socket.id);

  socket.on('join-room', ({ roomId, userName }) => {
    console.log(`User ${userName} (${socket.id}) joining room ${roomId}`);
    
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }
    
    // Add user to room
    rooms[roomId].push({ id: socket.id, userName });
    
    // Join the socket room
    socket.join(roomId);
    
    // Send list of all users in the room to the new user
    socket.emit('all-users', rooms[roomId]);
    
    // Notify other users in the room
    socket.to(roomId).emit('user-joined', { 
      signal: null, 
      callerID: socket.id,
      userName 
    });
  });

  socket.on('sending-signal', payload => {
    console.log(`Signal from ${socket.id} to ${payload.userToSignal}`);
    io.to(payload.userToSignal).emit('user-joined', { 
      signal: payload.signal, 
      callerID: socket.id,
      userName: rooms[payload.roomId]?.find(user => user.id === socket.id)?.userName
    });
  });

  socket.on('returning-signal', payload => {
    console.log(`Returning signal from ${socket.id} to ${payload.callerID}`);
    io.to(payload.callerID).emit('receiving-returned-signal', { 
      signal: payload.signal, 
      id: socket.id 
    });
  });

  socket.on('chat-message', ({ roomId, ...message }) => {
    console.log(`Chat message in room ${roomId} from ${message.sender}: ${message.text}`);
    io.to(roomId).emit('chat-message', message);
  });

  socket.on('leave-room', roomId => {
    console.log(`User ${socket.id} leaving room ${roomId}`);
    if (rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(user => user.id !== socket.id);
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
      }
    }
    socket.to(roomId).emit('user-left', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Find and remove user from all rooms
    Object.keys(rooms).forEach(roomId => {
      if (rooms[roomId]) {
        rooms[roomId] = rooms[roomId].filter(user => user.id !== socket.id);
        if (rooms[roomId].length === 0) {
          delete rooms[roomId];
        } else {
          io.to(roomId).emit('user-left', socket.id);
        }
      }
    });
  });

  socket.on('error', error => {
    console.error('Socket error:', error);
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('WebSocket server is ready');
}); 
