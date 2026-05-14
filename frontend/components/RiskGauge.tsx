"use client";

interface Props {
  probability: number;
  color: string;
  band: string;
}

export default function RiskGauge({ probability, color, band }: Props) {
  const pct = Math.round(probability * 100);
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * probability;

  const bandLabel: Record<string, string> = {
    low: "Low Risk", medium: "Moderate Risk", high: "High Risk",
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e5e7eb" strokeWidth="14" />
        <circle
          cx="70" cy="70" r={r} fill="none"
          stroke={color} strokeWidth="14"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
        />
        <text x="70" y="65" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>
          {pct}%
        </text>
        <text x="70" y="85" textAnchor="middle" fontSize="11" fill="#6b7280">
          risk score
        </text>
      </svg>
      <span
        className="px-3 py-1 rounded-full text-sm font-semibold text-white"
        style={{ backgroundColor: color }}
      >
        {bandLabel[band] ?? band}
      </span>
    </div>
  );
}
