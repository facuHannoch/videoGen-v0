interface IntroTitleProps {
  text: string;
}

export const ZIndexTitle = ({ text }: IntroTitleProps) => {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        backgroundColor: "rgba(255,255,255,0.94)",
        color: "#0f172a",
        borderRadius: 10,
        boxShadow: "0 18px 48px rgba(2,6,23,0.34)",
        border: "1px solid rgba(191, 219, 254, 0.8)",
        fontSize: 76,
        maxWidth: "78%",
        padding: "28px 34px",
        lineHeight: 1.06,
        letterSpacing: -1.5,
        fontWeight: 800,
        textAlign: "center",
        wordBreak: "break-word",
      }}
    >
      {text}
    </div>
  );
};
