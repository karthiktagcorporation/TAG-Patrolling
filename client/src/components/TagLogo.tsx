import { useState } from "react";

/**
 * TAG logo. Prefers the real brand asset at `client/public/tag-logo.png` if
 * present (see README "Logo" section for the exact drop-in step); falls back
 * to an accurate SVG recreation of the mark otherwise, so the app always
 * renders correctly even before the real file is added.
 *
 * Sizing rule (do not change without re-checking both branches): only
 * `height` is ever set in CSS; `width` is always left at its default `auto`.
 * For both `<img>` and inline `<svg>` this means the browser derives width
 * from the element's own intrinsic aspect ratio (the image file's natural
 * dimensions, or the `viewBox` ratio for the SVG fallback) — so the mark
 * scales uniformly and can never be stretched/squashed by a parent's fixed
 * width or height.
 */
export default function TagLogo({ className = "", height = 64 }: { className?: string; height?: number }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!imageFailed) {
    return (
      <img
        src="/tag-logo.png"
        alt="TAG - Power to People"
        className={className}
        style={{ height, width: "auto", display: "block" }}
        onError={() => setImageFailed(true)}
      />
    );
  }

  // Fallback recreation, used only if /tag-logo.png hasn't been added yet.
  return (
    <div className={`flex flex-col items-center ${className}`} style={{ height }}>
      <svg viewBox="0 0 300 130" style={{ height: height * 0.72, width: "auto" }} xmlns="http://www.w3.org/2000/svg">
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
