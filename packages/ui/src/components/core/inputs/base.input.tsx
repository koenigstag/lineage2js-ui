import type { ChangeEvent, CSSProperties } from "react";

export interface BaseInputProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  type?: "text" | "password";
  style?: CSSProperties;
}

export function BaseInput({ value, placeholder, onChange, disabled, type = "text", style }: BaseInputProps) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      style={{
        width: "100%",
        boxSizing: "border-box",
        background: "#1e1e1e",
        color: "#999999",
        border: "1px solid #666666",
        borderRadius: 4,
        padding: "6px 8px",
        ...style,
      }}
    />
  );
}
