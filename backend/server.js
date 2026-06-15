const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// i use this to keep track of which socket is in which room
// so when someone disconnects i can tell the other person
let socketRooms = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // when a user wants to join a room they send roomId and their peerId
    socket.on('join-room', (roomId, peerId) => {
        socket.join(roomId);

        // save the mapping so i can look it up later on disconnect
        socketRooms.set(socket.id, { roomId, peerId });

        console.log(`User ${socket.id} joined room: ${roomId} with PeerID: ${peerId}`);

        // let everyone else in the room know that a new person joined
        socket.to(roomId).emit('user-joined', peerId);
    });

    socket.on('disconnect', () => {
        let info = socketRooms.get(socket.id);

        if (info) {
            // tell the other person in the room that this user left
            socket.to(info.roomId).emit('user-disconnected', info.peerId);
            socketRooms.delete(socket.id);
        }

        console.log('User disconnected:', socket.id);
    });
});

// using env variable so i can change port during deploymnet
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Signaling server running on http://localhost:${PORT}`);
});
