import type { CSSProperties } from "react";

interface SpeakerOnIconProps {
  size?: number;
  style?: CSSProperties;
}

export const SpeakerOnIcon = ({ size = 30, style }: SpeakerOnIconProps) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      style={style}
    >
      <path d="M3 7.25H5.75L9.1 4.5V13.5L5.75 10.75H3V7.25Z" fill="currentColor" />
      <path
        d="M11.35 6.1C12.35 6.95 12.95 7.95 12.95 9C12.95 10.05 12.35 11.05 11.35 11.9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12.95 4.45C14.45 5.7 15.3 7.3 15.3 9C15.3 10.7 14.45 12.3 12.95 13.55"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
};
