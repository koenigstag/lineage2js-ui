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
  background: "#2a2a2a",
  color: "#cccccc",
  border: "1px solid #666666",
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
