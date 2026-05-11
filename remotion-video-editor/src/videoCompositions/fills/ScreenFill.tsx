import type { ReactNode } from "react";

interface ScreenFillProps {
  children?: ReactNode;
  background?: string;
  justify?: React.CSSProperties["justifyContent"];
  align?: React.CSSProperties["alignItems"];
}

export const ScreenFill = ({
  children,
  background = "#DCDCDC",
  justify = "center",
  align = "center",
}: ScreenFillProps) => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background,
        display: "flex",
        flexDirection: "column",
        justifyContent: justify,
        alignItems: align,
      }}
    >
      {children}
    </div>
  );
};
