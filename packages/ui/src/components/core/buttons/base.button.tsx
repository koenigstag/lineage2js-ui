import type { CSSProperties, MouseEvent, ReactNode } from "react";

export interface BaseButtonProps {
  children: ReactNode;
  onClick?: (event: MouseEvent) => void;
  href?: string;
  disabled?: boolean;
  style?: CSSProperties;
}

const baseStyle: CSSProperties = {
  display: "inline-block",
  background: "#3c3425",
  color: "#b5af9f",
  border: "1px solid #5d4f48",
  borderRadius: 4,
  padding: "6px 12px",
  textAlign: "center",
  textDecoration: "none",
  cursor: "pointer",
};

export function BaseButton({ children, onClick, href, disabled, style }: BaseButtonProps) {
  if (href) {
    return (
      <a href={href} style={{ ...baseStyle, ...style }} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ ...baseStyle, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer", ...style }}
    >
      {children}
    </button>
  );
}
