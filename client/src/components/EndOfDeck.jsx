export default function EndOfDeck({ onOpenResults }) {
  return (
    <div className="end" role="status">
      <div className="end__kicker">Issue Complete</div>
      <h2 className="end__title">
        You've reviewed the <em>entire</em> kennel.
      </h2>
      <p className="end__body">
        Now see how the collective verdict shook out — who got adopted, who got passed, and who divided the room.
      </p>
      <div className="end__cta">
        <button className="btn btn--text" onClick={onOpenResults}>Open Results →</button>
      </div>
    </div>
  );
}
