import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import Peer from 'peerjs';
import StatusBar from './components/StatusBar';
import RoomCard from './components/RoomCard';
import TransferCard from './components/TransferCard';
import { generateRoomId, formatBytes, computeHash } from './utils';
import './App.css';

// connect to localhost for testing, but in production we connect to our deployed server.
// i check window.location.hostname to see if we are running locally.
// if it is localhost or 127.0.0.1, we connect to local server port 5000,
// otherwise we use our deployed signaling server on Render.
const socketUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000' 
  : 'https://your-backend-url.onrender.com'; // REPLACE THIS with your Render URL when deployed

const socket = io(socketUrl);
const CHUNK_SIZE = 16 * 1024; // 16kb per chunk. WebRTC data channel limit is usually 64kb max, so 16kb is safe

function App() {
  const [roomId, setRoomId] = useState('');
  const [activeRoom, setActiveRoom] = useState('');
  const [status, setStatus] = useState('Disconnected');
  const [statusType, setStatusType] = useState('disconnected');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState('');
  const [hashResult, setHashResult] = useState(null);
  const [transferDone, setTransferDone] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // i use refs to keep track of PeerJS instance and direct direct connection channel.
  // refs are great because updating them doesn't trigger component re-renders
  const peerInstance = useRef(null);
  const connectionRef = useRef(null);
  const receiveBuffer = useRef([]);
  const expectedFile = useRef(null);
  const receivedChunks = useRef(0);
  const speedTracker = useRef({ startTime: 0, bytes: 0 });

  // calcualtes transfer speed and updates the progress bar
  const updateSpeed = useCallback((bytesTransferred, totalBytes) => {
    let now = Date.now();

    // set start time on first call
    if (speedTracker.current.startTime === 0) {
      speedTracker.current.startTime = now;
      speedTracker.current.bytes = 0;
    }

    speedTracker.current.bytes = bytesTransferred;

    // calculate speed (bytes per second)
    let elapsed = (now - speedTracker.current.startTime) / 1000;
    if (elapsed > 0.3) {
      let bytesPerSec = bytesTransferred / elapsed;
      setSpeed(formatBytes(bytesPerSec) + '/s');
    }

    // calculate percentage
    let percent = Math.round((bytesTransferred / totalBytes) * 100);
    if (percent > 100) percent = 100;
    setProgress(percent);
  }, []);

  // this function sets up the listener for incoming data on a peer connection.
  // it handles both metadata messages and actual file chunks.
  // i wrap it in useCallback so it doesn't get recreated on every render.
  const setupDataListener = useCallback((conn) => {
    conn.on('data', async (data) => {

      // first the sender sends metadata (filename, size, hash etc)
      if (data && data.type === 'metadata') {
        expectedFile.current = data;
        receiveBuffer.current = [];
        receivedChunks.current = 0;
        speedTracker.current = { startTime: 0, bytes: 0 };
        setProgress(0);
        setSpeed('');
        setHashResult(null);
        setTransferDone(false);
        setStatus('Receiving: ' + data.name);
        setStatusType('waiting');
        return;
      }

      // if its not metadata, its a file chunk so push it to buffer
      receiveBuffer.current.push(data);
      receivedChunks.current = receivedChunks.current + 1;

      let bytesReceived = receivedChunks.current * CHUNK_SIZE;
      updateSpeed(bytesReceived, expectedFile.current.size);

      // check if we got all the chunks
      if (receivedChunks.current === expectedFile.current.totalChunks) {
        setStatus('Verifying file integrity...');

        // combine all chunks into one blob and compute hash
        let blob = new Blob(receiveBuffer.current);
        let arrayBuffer = await blob.arrayBuffer();
        let receivedHash = await computeHash(arrayBuffer);

        // compare with the hash the sender gave us
        let isVerified = (receivedHash === expectedFile.current.hash);

        // only show first 16 chars of hash, full hash is too long for ui
        let shortHash = receivedHash.substring(0, 16) + '...';

        setHashResult({
          verified: isVerified,
          hash: shortHash,
        });

        if (isVerified) {
          setStatus('Transfer complete - hash verified');
          setStatusType('connected');
        } else {
          setStatus('Transfer complete - hash mismatch');
          setStatusType('disconnected');
        }

        setTransferDone(true);

        // auto download the file by creating a temp link in the DOM
        let downloadUrl = URL.createObjectURL(blob);
        let link = document.createElement('a');
        link.href = downloadUrl;
        link.download = expectedFile.current.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      }
    });
  }, [updateSpeed]);

  useEffect(() => {
    // initialize PeerJS. It generates a random Peer ID automatically
    let peer = new Peer();

    peer.on('open', () => {
      // check if the url has a room param like ?room=abc123
      // this is so the reciver can just click a link to join
      let params = new URLSearchParams(window.location.search);
      let urlRoom = params.get('room');
      if (urlRoom) {
        setRoomId(urlRoom);
      }
    });

    // when another peer connects to us (we are the receiver in this case)
    peer.on('connection', (conn) => {
      connectionRef.current = conn;
      setStatus('Peer connected');
      setStatusType('connected');
      setIsConnected(true);
      setupDataListener(conn);

      // handle if the other person closes their tab
      conn.on('close', () => {
        setStatus('Peer disconnected');
        setStatusType('disconnected');
        setIsConnected(false);
        connectionRef.current = null;
        setProgress(0);
        setSpeed('');
      });
    });

    peerInstance.current = peer;

    // socket connection to signaling server
    socket.on('connect', () => {
      setStatus('Connected to server');
      setStatusType('waiting');
    });

    // when a new user joins our room, i connect to them using their peerId
    socket.on('user-joined', (otherPeerId) => {
      let conn = peer.connect(otherPeerId);
      connectionRef.current = conn;

      conn.on('open', () => {
        setStatus('Peer connected');
        setStatusType('connected');
        setIsConnected(true);
        setupDataListener(conn);
      });

      conn.on('close', () => {
        setStatus('Peer disconnected');
        setStatusType('disconnected');
        setIsConnected(false);
        connectionRef.current = null;
        setProgress(0);
        setSpeed('');
      });
    });

    // this is the server telling us somone left the room
    socket.on('user-disconnected', () => {
      setStatus('Peer disconnected');
      setStatusType('disconnected');
      setIsConnected(false);
      connectionRef.current = null;
    });

    // cleanup on unmount
    return () => {
      socket.off('connect');
      socket.off('user-joined');
      socket.off('user-disconnected');
    };
  }, [setupDataListener]);

  // creates a new room with a random id and joins it
  function createRoom() {
    let newRoom = generateRoomId();
    setRoomId(newRoom);
    setActiveRoom(newRoom);

    let peerId = peerInstance.current?.id;
    if (peerId) {
      socket.emit('join-room', newRoom, peerId);
      setStatus('Room created, waiting for peer...');
      setStatusType('waiting');
    }
  }

  // join an existing room by its id
  function joinRoom() {
    if (roomId.trim() === '') return;

    setActiveRoom(roomId);
    let peerId = peerInstance.current?.id;
    if (peerId) {
      socket.emit('join-room', roomId, peerId);
      setStatus('Joined room, waiting for peer...');
      setStatusType('waiting');
    }
  }

  // main function that handles sending the file to the connected peer
  async function sendFile() {
    if (!connectionRef.current) {
      alert('No peer connected. Share the room link and wait for someone to join.');
      return;
    }
    if (!file) {
      alert('No file selected.');
      return;
    }

    // reset everything before starting
    setProgress(0);
    setSpeed('');
    setHashResult(null);
    setTransferDone(false);
    speedTracker.current = { startTime: 0, bytes: 0 };

    // read the file into an array buffer
    let fileBuffer = await file.arrayBuffer();
    let totalChunks = Math.ceil(fileBuffer.byteLength / CHUNK_SIZE);

    // compute hash of the file before sending
    // the reciever will compute the same hash and compare
    setStatus('Computing file hash...');
    let fileHash = await computeHash(fileBuffer);

    // send metadata first so the reciever knows what to expect
    connectionRef.current.send({
      type: 'metadata',
      name: file.name,
      size: file.size,
      totalChunks: totalChunks,
      hash: fileHash,
    });

    setStatus('Sending: ' + file.name);
    setStatusType('waiting');

    // now send the actual file data in chunks
    let offset = 0;
    while (offset < fileBuffer.byteLength) {
      let chunk = fileBuffer.slice(offset, offset + CHUNK_SIZE);
      connectionRef.current.send(chunk);
      offset = offset + CHUNK_SIZE;

      updateSpeed(offset, fileBuffer.byteLength);
    }

    setStatus('File sent');
    setStatusType('connected');
    setTransferDone(true);

    // show hash on the sender side too
    let shortHash = fileHash.substring(0, 16) + '...';
    setHashResult({
      verified: true,
      hash: shortHash,
    });
  }

  return (
    <div className="app">
      <div className="app-header">
        <h1 className="app-title">P2P WebShare</h1>
        <p className="app-subtitle">Direct browser-to-browser file transfer</p>
      </div>

      {/* status indicator */}
      <StatusBar status={status} statusType={statusType} />

      {/* room creation and joining */}
      <RoomCard
        roomId={roomId}
        setRoomId={setRoomId}
        activeRoom={activeRoom}
        onJoin={joinRoom}
        onCreate={createRoom}
      />

      {/* file transfer section */}
      <TransferCard
        file={file}
        setFile={setFile}
        onSend={sendFile}
        progress={progress}
        speed={speed}
        hashResult={hashResult}
        transferDone={transferDone}
        isConnected={isConnected}
      />
    </div>
  );
}

export default App;
