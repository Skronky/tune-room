const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// Track rooms
const rooms = {};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-room', ({ roomId, userName }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;

    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push({ id: socket.id, userName });

    // Tell the new user about existing peers
    const others = rooms[roomId].filter(p => p.id !== socket.id);
    socket.emit('room-peers', others);

    // Tell existing peers about the new user
    socket.to(roomId).emit('peer-joined', { id: socket.id, userName });

    console.log(`${userName} joined room ${roomId}`);
  });

  // WebRTC signaling relay
  socket.on('offer', ({ to, offer }) => {
    io.to(to).emit('offer', { from: socket.id, userName: socket.userName, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(p => p.id !== socket.id);
      if (rooms[roomId].length === 0) delete rooms[roomId];
      socket.to(roomId).emit('peer-left', { id: socket.id });
    }
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`MOOZ server running on http://localhost:${PORT}`);
});
