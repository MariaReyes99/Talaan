/** Tala, Talaan's guide: an original star mascot. The mouth moves while she talks. */
function starPoints(cx: number, cy: number, R: number, r: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    return `${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}
const STAR = starPoints(50, 54, 44, 24);

export default function TalaAvatar({ label = 'Tala', gender = 'female' }: { label?: string; gender?: 'female' | 'male' }) {
  return (
    <svg className="tala-svg" viewBox="0 0 100 100" role="img" aria-label={label}>
      <polygon points={STAR} fill="#F6B21A" stroke="#F6B21A" strokeWidth={10} strokeLinejoin="round" />
      <polygon points={STAR} fill="none" stroke="#C98A00" strokeWidth={2} strokeLinejoin="round" opacity={0.35} />
      <ellipse cx={41} cy={52} rx={3.6} ry={4.6} fill="#1F2A37" />
      <ellipse cx={59} cy={52} rx={3.6} ry={4.6} fill="#1F2A37" />
      <circle cx={42.2} cy={50.6} r={1.2} fill="#fff" />
      <circle cx={60.2} cy={50.6} r={1.2} fill="#fff" />
      <ellipse cx={34} cy={60} rx={4} ry={2.6} fill="#F08A5D" opacity={0.55} />
      <ellipse cx={66} cy={60} rx={4} ry={2.6} fill="#F08A5D" opacity={0.55} />
      <g className="mouth"><path d="M43 62 Q50 69 57 62 Q50 65 43 62z" fill="#7A2E1F" /></g>
      {gender === 'female' ? (<g>
        <path d="M36.5 47.5 L35 45.5 M38.5 46.6 L37.8 44.3 M61.5 47.5 L63 45.5 M59.5 46.6 L60.2 44.3" stroke="#1F2A37" strokeWidth={1.3} strokeLinecap="round" />
        <g transform="translate(66 30)"><circle r={3.2} cx={0} cy={-4} fill="#E8505B" /><circle r={3.2} cx={4} cy={-1} fill="#E8505B" /><circle r={3.2} cx={2.5} cy={4} fill="#E8505B" /><circle r={3.2} cx={-2.5} cy={4} fill="#E8505B" /><circle r={3.2} cx={-4} cy={-1} fill="#E8505B" /><circle r={2.4} fill="#FFF4D9" /></g>
      </g>) : (<g>
        <path d="M36 44.5 Q41 42 45.5 44.5 M54.5 44.5 Q59 42 64 44.5" stroke="#1F2A37" strokeWidth={2} fill="none" strokeLinecap="round" />
        <g transform="translate(50 77)"><path d="M0 0 L-8 -4.5 L-8 4.5 Z M0 0 L8 -4.5 L8 4.5 Z" fill="#1E88C7" /><circle r={2.2} fill="#12355B" /></g>
      </g>)}
    </svg>
  );
}

export function TalaMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <polygon points={STAR} fill="#F6B21A" stroke="#F6B21A" strokeWidth={10} strokeLinejoin="round" />
    </svg>
  );
}
