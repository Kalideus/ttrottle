'use client';

import { useEffect } from 'react';

// Plays once per mount (re-mount with a new `key` to replay), then calls onDone.
// Purely decorative: pointer-events none, hidden from screen readers, and
// reduced to a brief "Done!" badge for people who prefer reduced motion.
const CONFETTI_COLORS = ['#FFC933', '#F06A6A', '#4ECBC4', '#A970D1', '#5DA283', '#4573D2'];
const PIECES = Array.from({ length: 28 }, (_, i) => ({
  left: 4 + ((i * 37) % 92), // spread across the width, deterministic so no hydration drift
  delay: (i % 7) * 0.12 + Math.floor(i / 7) * 0.35,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  drift: ((i * 53) % 80) - 40,
  spin: (i * 97) % 720,
}));

export function TukTukCelebration({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="tuktuk-stage" aria-hidden>
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="tuktuk-confetti"
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              animationDelay: `${p.delay}s`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}

      <div className="tuktuk-driver">
        <span className="tuktuk-dust" />
        <svg className="tuktuk-svg" viewBox="0 0 120 80" width="120" height="80">
          {/* people, drawn first so the frame sits in front of them */}
          <circle cx="36" cy="30" r="5" fill="#6B4A2E" />
          <path d="M28 43 Q36 34 44 43 Z" fill="#A970D1" />
          <circle cx="76" cy="29" r="5" fill="#3B2A1C" />
          <path d="M68 43 Q76 34 84 43 Z" fill="#4573D2" />
          {/* canopy frame with an open side, the classic tuk-tuk silhouette */}
          <path
            fillRule="evenodd"
            d="M8 44 V24 Q8 9 24 9 H84 Q93 9 97 17 L107 44 Z M16 43 V24 Q16 16 24 16 H83 Q88 16 90 21 L98 43 Z"
            fill="#1F6F43"
          />
          <rect x="56" y="15" width="5" height="29" fill="#1F6F43" />
          {/* body with a rounded nose */}
          <path d="M10 42 H104 Q116 43 116 53 V56 Q116 62 109 62 H12 Q5 62 5 55 V49 Q5 42 10 42 Z" fill="#FFC933" />
          <rect x="5" y="54" width="111" height="3" fill="#E0A100" />
          <rect x="14" y="45" width="36" height="6" rx="3" fill="#FFB400" />
          <circle cx="112" cy="48" r="3" fill="#FFF6C8" />
          {/* big rear wheel, small single front wheel */}
          <g className="tuktuk-wheel" style={{ transformOrigin: '28px 64px' }}>
            <circle cx="28" cy="64" r="10" fill="#222" />
            <circle cx="28" cy="64" r="4" fill="#bbb" />
            <rect x="27" y="55" width="2" height="18" fill="#555" />
          </g>
          <g className="tuktuk-wheel" style={{ transformOrigin: '101px 66px' }}>
            <circle cx="101" cy="66" r="8" fill="#222" />
            <circle cx="101" cy="66" r="3" fill="#bbb" />
            <rect x="100" y="59" width="2" height="14" fill="#555" />
          </g>
        </svg>
        <span className="tuktuk-flag">Task done! 🎉</span>
      </div>
    </div>
  );
}
