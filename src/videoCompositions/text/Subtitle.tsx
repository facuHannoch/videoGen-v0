export const Subtitle = ({ text }: { text: string }) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 120,
        width: "100%",
        textAlign: "center",
        color: "white",
        fontSize: 48,
        fontWeight: "bold",
      }}
    >
      {text}
    </div>
  );
};