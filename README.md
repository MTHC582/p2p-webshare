# P2P WebShare

A peer-to-peer file sharing web app that lets you transfer files directly between browsers using WebRTC. No files are stored on any server - everything goes straight from one browser to another.

## How it works (Methodology)

```
Sender Browser  <--- WebRTC Data Channel --->  Receiver Browser
       \                                          /
        \_______ Socket.io Signaling Server ______/
                  (handshake only, no file data)
```

### 1. Signaling Handshake
WebRTC requires direct connection between browsers, but browsers do not know each others IP addresses or connection configurations initially. I built a lightweight Node.js/Socket.io signaling server to coordinate the handshake:
- When a user joins or creates a room, their PeerJS ID is saved in the server's room mapping.
- The server alerts the other peer inside the room that someone new joined and sends their PeerJS ID.
- The browsers exchange connection details (SDP offer, answer, and ICE candidates) via the server.

### 2. Direct P2P Tunnel
Once the initial handshake completes, the signaling server steps out of the loop:
- A direct peer-to-peer WebRTC connection is opened between the sender and receiver.
- This creates an encrypted `RTCDataChannel` direct stream.
- The server never touches, reads, or hosts any of the actual file data.

### 3. Data Pipeline & Chunking
Standard browser memory cannot hold massive files all at once, and WebRTC has buffer limits (maximum message sizes of ~64KB are supported, though 16KB is standard for data channels):
- The sender reads the file into memory using the HTML5 `FileReader` API as an `ArrayBuffer`.
- I split this buffer into small chunks of **16KB** (`CHUNK_SIZE`).
- The sender transmits a metadata packet first containing the filename, size, chunk count, and a SHA-256 integrity hash.
- The sender streams the binary chunks sequentially over the WebRTC data channel.
- The receiver stores the incoming chunks inside a JavaScript `Array` buffer.

### 4. Integrity Verification & Assembly
To guarantee that the file did not get corrupted during P2P transmission (e.g. lost packets or out-of-order chunks):
- On receiving the final chunk, the receiver combines the chunk array into a single `Blob`.
- The receiver converts the blob to an `ArrayBuffer` and computes its SHA-256 hash using the browser's built-in `crypto.subtle.digest` API.
- If the receiver's hash matches the sender's metadata hash, the file integrity is verified!
- The app automatically triggers a local download using an in-memory DOM object URL.

## Tech Stack

- **Frontend** - React.js, Vite
- **P2P Channel** - WebRTC via PeerJS library
- **Signaling Server** - Node.js, Express, Socket.io
- **File Verification** - Web Crypto API (SHA-256)

## Features

- Drag and drop file selection
- Shareable room links
- Real time progress bar with transfer speed (MB/s) calculation
- SHA-256 cryptographic integrity checks
- Graceful disconnect handling (detects when peer leaves or tab closes)
- Auto download on completion

## Setup

### What you need

- Node.js (v18 or later)
- npm

### Install

```bash
git clone https://github.com/MTHC582/p2p-webshare
cd p2p-webshare

# install backend stuff
cd backend
npm install

# install frontend stuff
cd ../frontend
npm install
```

### Run

Open two terminals:

```bash
# terminal 1 - backend
cd backend
npm start

# terminal 2 - frontend
cd frontend
npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:5000`.

### How to use

1. Open the app in your browser
2. Click "Create" to make a new room
3. Copy the room link and open it in another tab (or send to someone)
4. Drag a file onto the drop zone or click to select one
5. Hit "Send File"
6. The file auto downloads on the other side once its done

## Deployment Guide

Here is how i deployed the app online so anyone can use it.

### 1. Deploy the Backend (Signaling Server) to Render
Render is free and hosts Node.js apps.
1. Sign up on [Render](https://render.com) using your GitHub account
2. Click **New +** and choose **Web Service**
3. Select this GitHub repository
4. Set these configuration values:
   - **Name**: `p2p-webshare-backend`
   - **Environment**: `Node`
   - **Root Directory**: `backend` (this tells Render to only run the backend code)
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Click **Deploy Web Service**
6. Copy the URL Render generates for you (e.g. `https://p2p-webshare-backend.onrender.com`)

> [!NOTE]
> **Render Free Tier Spin Down**: Because we host the signaling server on Render's free tier, the backend server goes to sleep automatically if it is idle for 15 minutes. When accessing the web app for the first time after it sleeps, it can take **50 to 60 seconds** for the backend server to wake up and connect (the connection dot will remain orange/waiting during this time). Once the server is awake, connections will be instant and stable.

### 2. Connect Frontend to the Deployed Backend
1. Open `frontend/src/App.jsx` in your code editor
2. On line 13, replace the dummy URL inside `https://your-backend-url.onrender.com` with your actual Render URL (from step 1)
3. Commit and push the changes to GitHub

### 3. Deploy the Frontend to Vercel
Vercel is free and great for hosting Vite/React frontends.
1. Sign up on [Vercel](https://vercel.com) using your GitHub account
2. Click **Add New...** and select **Project**
3. Import this GitHub repository
4. Set these settings:
   - **Framework Preset**: `Vite` (automatically detected)
   - **Root Directory**: `frontend` (tells Vercel to only build the frontend code)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click **Deploy**
6. Open the link Vercel gives you and the application is ready!

## Folder Structure

```
p2p-webshare/
├── backend/
│   ├── server.js          # signaling server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/    # split UI files
│   │   │   ├── RoomCard.jsx
│   │   │   ├── StatusBar.jsx
│   │   │   └── TransferCard.jsx
│   │   ├── App.jsx        # main app component
│   │   ├── App.css        # styles
│   │   ├── index.css      # global styles
│   │   ├── utils.js       # helper functions
│   │   └── main.jsx       # entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── .gitignore
└── README.md
```

## License

MIT
