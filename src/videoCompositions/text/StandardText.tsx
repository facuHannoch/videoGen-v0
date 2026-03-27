import type { CSSProperties } from "react";

interface StandardTextProps {
  text?: string;
  className?: string;
  style?: CSSProperties;
}

export const StandardText = ({ text, className, style }: StandardTextProps) => {
  return (
    <div
      className={className}
      style={{
        backgroundColor: "white",
        color: "black",
        fontSize: 64,
        fontWeight: "bold",
        textAlign: "center",
        padding: "18px 28px",
        borderRadius: 8,
        maxWidth: "100%",
        display: "inline-block",
        boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
        lineHeight: 1.15,
        wordBreak: "break-word",
        ...style,
      }}
    >
      {text}
    </div>
  );
};