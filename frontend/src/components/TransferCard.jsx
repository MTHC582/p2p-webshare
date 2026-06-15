// handles file selection (drag and drop or click), sending,
// progress bar, and hash verification display.
// i split this card out because it keeps the render block of App.jsx simple.

import { useState } from 'react';
import { formatBytes } from '../utils';

function TransferCard({ file, setFile, onSend, progress, speed, hashResult, transferDone, isConnected }) {
  // tracks if a file is being dragged over the zone so we can add a visual class
  let [dragOver, setDragOver] = useState(false);

  // handler for when user drags and drops a file into the dashed box
  function handleFileDrop(e) {
    e.preventDefault();
    setDragOver(false);
    let droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
    }
  }

  // handler for when user clicks the drop zone to browse and select a file
  function handleFileSelect(e) {
    let selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Transfer</div>

      {/* drag and drop zone box */}
      <div
        className={'drop-zone' + (dragOver ? ' drag-over' : '')}
        // need to prevent default drag behavior so the file doesn't just open in browser tab
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleFileDrop}
      >
        {/* hidden input that allows clicking anywhere on the parent box to select file */}
        <input
          id="file-input"
          type="file"
          onChange={handleFileSelect}
        />
        <p className="drop-zone-label">
          Drop a file here or <span>browse</span>
        </p>
      </div>

      {/* if a file is selected, show its name and formatted size underneath the box */}
      {file && (
        <div className="file-info">
          <span className="file-name">{file.name}</span>
          <span className="file-size">{formatBytes(file.size)}</span>
        </div>
      )}

      {/* show progress bar and transfer speed only if transfer has started */}
      {progress > 0 && (
        <div className="progress-section">
          <div className="progress-header">
            <span className="progress-percent">{progress}%</span>
            {speed && <span className="progress-speed">{speed}</span>}
          </div>
          <div className="progress-track">
            {/* if transfer is finished, add the complete class to make the bar green */}
            <div
              className={'progress-fill' + (transferDone ? ' complete' : '')}
              style={{ width: progress + '%' }}
            ></div>
          </div>
        </div>
      )}

      {/* if the file hash was calculated and verified, show it below progress */}
      {hashResult && (
        <div className={'hash-result ' + (hashResult.verified ? 'verified' : 'failed')}>
          {/* if hashes match, show verified. otherwise show mismatch warning */}
          SHA-256: {hashResult.hash} {hashResult.verified ? '- verified' : '- MISMATCH'}
        </div>
      )}

      {/* button is disabled if no file is chosen or if peer connection isn't open yet */}
      <button
        id="btn-send"
        className="btn btn-send"
        onClick={onSend}
        disabled={!file || !isConnected}
      >
        Send File
      </button>
    </div>
  );
}

export default TransferCard;
