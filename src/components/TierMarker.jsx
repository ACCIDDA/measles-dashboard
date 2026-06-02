import { TIER_COLORS } from '../config/index.js';

export default function TierMarker({ tier }) {
  // no tier (e.g. a school with no coverage estimate, #60): neutral grey dot.
  if (!tier) return <circle cx="6" cy="6" r="5" fill="#bbb" />;
  const color = TIER_COLORS[tier];
  if (tier === 'H') return <circle cx="6" cy="6" r="5" fill={color} />;
  if (tier === 'M') return <rect x="1" y="1" width="10" height="10" rx="1" fill={color} />;
  return <polygon points="6,1 11,11 1,11" fill={color} />;
}
