/**
 * TAG logo placeholder. Matches the brand mark shown in the reference
 * screenshot (grey "T"/"G", red "A" with white upward arrow, red/grey
 * "POWER TO PEOPLE" wordmark). To replace with the real artwork, drop a
 * same-size SVG/PNG at client/public/tag-logo.png and set `useImage`.
 */
export default function TagLogo({ className = "", height = 64 }: { className?: string; height?: number }) {
  return (
    <div className={`flex flex-col items-center ${className}`} style={{ height }}>
      <svg viewBox="0 0 300 130" style={{ height: height * 0.72 }} xmlns="http://www.w3.org/2000/svg">
        <text x="0" y="95" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="110" fill="#6D6E71">T</text>
        <text x="78" y="95" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="110" fill="#D3352B">A</text>
        <text x="175" y="95" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="110" fill="#6D6E71">G</text>
        <polygon points="118,45 138,45 138,60 152,60 128,90 104,60 118,60" fill="#ffffff" />
      </svg>
      <div className="flex items-baseline gap-1 -mt-1" style={{ fontSize: height * 0.14 }}>
        <span className="font-bold text-tag-red tracking-wide">POWER</span>
        <span className="font-semibold text-tag-gray tracking-wide">TO PEOPLE</span>
      </div>
    </div>
  );
}
