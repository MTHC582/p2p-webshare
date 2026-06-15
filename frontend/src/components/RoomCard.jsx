// handles room creation, joining, and showing the sharable link.
// i put this in a separate component because the room form logic is separate
// from the actual file sending/receiving logic.

import { useState } from 'react';

function RoomCard({ roomId, setRoomId, activeRoom, onJoin, onCreate }) {
  // tracks if we copied the link so we can briefly change button text to "Copied"
  let [copied, setCopied] = useState(false);

  // builds the sharable room link. it uses window.location.origin so that it
  // automatically updates if we run it on localhost or a deployed URL (like vercel)
  function getRoomLink() {
    return window.location.origin + '?room=' + activeRoom;
  }

  // copies the room link to clipboard. I use navigator.clipboard.writeText
  // which works on modern browsers, and set a timeout to change the button
  // text back to "Copy" after 2 seconds so the user gets clear visual feedback
  function copyLink() {
    let link = getRoomLink();
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      // reset the "Copied" text after 2 secs
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  }

  return (
    <div className="card">
      <div className="card-title">Room</div>

      {/* if user has not joined any room yet, show the join/create inputs */}
      {!activeRoom ? (
        <div className="room-controls">
          <input
            id="room-input"
            className="room-input"
            type="text"
            placeholder="Enter room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            // if they hit enter in the input, call the join function directly
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onJoin();
              }
            }}
          />
          <button id="btn-join" className="btn btn-primary" onClick={onJoin}>
            Join
          </button>
          <button id="btn-create" className="btn btn-secondary" onClick={onCreate}>
            Create
          </button>
        </div>
      ) : (
        /* once they are in a room, show the invite link instead of inputs */
        <div className="room-link-row">
          <span className="room-link-text">{getRoomLink()}</span>
          <button id="btn-copy" className="btn btn-secondary btn-copy" onClick={copyLink}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}

export default RoomCard;
