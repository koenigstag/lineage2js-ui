import type { ChangeEvent, CSSProperties, KeyboardEvent } from "react";

export interface BaseInputProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  maxLength?: number;
  type?: "text" | "password" | "number";
  style?: CSSProperties;
}

export function BaseInput({
  value,
  placeholder,
  onChange,
  onKeyDown,
  disabled,
  maxLength,
  type = "text",
  style,
}: BaseInputProps) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={maxLength}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
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
