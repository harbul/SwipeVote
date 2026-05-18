import { motion, useMotionValue, useTransform } from 'framer-motion';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

/**
 * Single swipeable card. Owns its own exit animation; parent gets notified
 * after the animation completes so the card can be cleanly removed from the deck.
 *
 * Props:
 *  - item: { id, label, description, image_url }
 *  - position: index within visible stack (0 = top)
 *  - onVote(choice): fired immediately when an exit is triggered (parent should POST + record history)
 *  - onExitDone(choice): fired after the exit animation finishes (parent removes from deck)
 *  - active: drag enabled & ref-driven trigger available
 *
 * Ref: exposes { triggerVote(choice) } so the parent's buttons can drive the same exit.
 */
const SWIPE_THRESHOLD = 110;
const VELOCITY_THRESHOLD = 500;

const DOWN_THRESHOLD = 110;

const SwipeCard = forwardRef(function SwipeCard(
  { item, position, onVote, onExitDone, onSwipeDown, active },
  ref
) {
  const x = useMotionValue(0);
  const rotate     = useTransform(x, [-260, 0, 260], [-14, 0, 14]);
  const yesOpacity = useTransform(x, [0, 80, 180],   [0, 0.5, 1]);
  const noOpacity  = useTransform(x, [-180, -80, 0], [1, 0.5, 0]);
  const yesStamp   = useTransform(x, [40, 130],      [0, 1]);
  const noStamp    = useTransform(x, [-130, -40],    [1, 0]);

  const [exitChoice, setExitChoice] = useState(null);
  const exitingRef = useRef(false);

  // Track when the user first saw this card as the top card, so we can
  // measure decision time. Reset whenever this card becomes active.
  const activatedAtRef = useRef(active ? Date.now() : null);
  useEffect(() => {
    if (active && activatedAtRef.current == null) activatedAtRef.current = Date.now();
  }, [active]);

  const trigger = (choice) => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    setExitChoice(choice);
    const decisionMs = activatedAtRef.current ? Date.now() - activatedAtRef.current : null;
    onVote?.(choice, decisionMs);
  };

  useImperativeHandle(ref, () => ({ triggerVote: trigger }), []);

  const handleDragEnd = (_, info) => {
    if (!active || exitingRef.current) return;
    const dx = info.offset.x, dy = info.offset.y;
    const vx = info.velocity.x, vy = info.velocity.y;

    // Downward pull dominates: open Results.
    if (dy > DOWN_THRESHOLD && Math.abs(dx) < 60 && vy > -200) {
      onSwipeDown?.();
      return;
    }
    if (dx >  SWIPE_THRESHOLD || vx >  VELOCITY_THRESHOLD) trigger('yes');
    else if (dx < -SWIPE_THRESHOLD || vx < -VELOCITY_THRESHOLD) trigger('no');
  };

  // Stacking: each non-top card sits slightly back & rotated
  const isTop = position === 0;
  const baseScale  = isTop ? 1 : 1 - position * 0.04;
  const baseY      = position * 10;
  const baseRotate = isTop ? 0 : (position % 2 === 0 ? -2 : 2);

  return (
    <motion.div
      className="card"
      style={{ x, rotate, zIndex: 100 - position }}
      initial={{ scale: baseScale * 0.96, y: baseY + 8, opacity: 0 }}
      animate={
        exitChoice
          ? {
              x: exitChoice === 'yes' ? 520 : -520,
              y: 40,
              opacity: 0,
              rotate: exitChoice === 'yes' ? 24 : -24,
              transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
            }
          : { scale: baseScale, y: baseY, opacity: 1, rotate: baseRotate }
      }
      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      drag={active && !exitChoice}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={{ left: 0.85, right: 0.85, top: 0.15, bottom: 0.55 }}
      onDragEnd={handleDragEnd}
      onAnimationComplete={(latest) => {
        if (exitChoice && latest && latest.opacity === 0) {
          onExitDone?.(exitChoice);
        }
      }}
      whileTap={active ? { cursor: 'grabbing' } : {}}
    >
      <div className="card__image-wrap">
        <img
          className="card__image"
          src={item.image_url}
          alt={item.label}
          draggable={false}
          loading={isTop ? 'eager' : 'lazy'}
        />
        <span className="card__chip">Edition №{String(item.id).padStart(3, '0')}</span>
        <motion.div className="card__tint card__tint--yes" style={{ opacity: yesOpacity }} />
        <motion.div className="card__tint card__tint--no"  style={{ opacity: noOpacity  }} />
        <motion.div className="card__stamp card__stamp--yes" style={{ opacity: yesStamp }}>Adopt</motion.div>
        <motion.div className="card__stamp card__stamp--no"  style={{ opacity: noStamp  }}>Pass</motion.div>
      </div>

      <div className="card__body">
        <h2 className="card__name">{renderName(item.label)}</h2>
        <p className="card__desc">{item.description}</p>
      </div>
    </motion.div>
  );
});

export default SwipeCard;

// Italicize the LAST word of the breed name for the editorial accent.
function renderName(label) {
  const parts = label.split(' ');
  if (parts.length === 1) return <em>{parts[0]}</em>;
  const last = parts.pop();
  return (
    <>
      {parts.join(' ')} <em>{last}</em>
    </>
  );
}
