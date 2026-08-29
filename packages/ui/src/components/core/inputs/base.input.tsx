import type { ChangeEvent, CSSProperties, KeyboardEvent } from "react";

export interface BaseInputProps {
  value: string;
  /** Set beside the field rather than inside it, on the same line. */
  label?: string;
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
  label,
  placeholder,
  onChange,
  onKeyDown,
  disabled,
  maxLength,
  type = "text",
  style,
}: BaseInputProps) {
  const field = (
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

  if (!label) return field;
  // `display: contents` so the label and the field become cells of the
  // surrounding FieldGrid rather than a row of their own -- that is what keeps
  // every control on the panel starting at the same x.
  return (
    <label style={{ display: "contents" }}>
      <span
        style={{
          color: "#8a8a8a",
          fontSize: 12,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {field}
    </label>
  );
}
