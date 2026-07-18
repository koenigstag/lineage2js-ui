import type { CSSProperties, PropsWithChildren } from "react";

export interface ScreenProps {
  className?: string;
  style?: CSSProperties;
}

export function Screen({ className, style, children }: PropsWithChildren<ScreenProps>) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#000000",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
