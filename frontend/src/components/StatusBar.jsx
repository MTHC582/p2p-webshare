// shows a small colored dot + text to indicate connection status.
// i separated this into its own component to keep App.jsx cleaner.
// it accepts status text and statusType (connected, waiting, disconnected)
// and maps it to different colored status dots defined in App.css

function StatusBar({ status, statusType }) {
  return (
    <div className="status-bar">
      {/* statusType is concatenated to style class so dot changes color dynamically */}
      <div className={'status-dot ' + statusType}></div>
      <span className="status-text">{status}</span>
    </div>
  );
}

export default StatusBar;
