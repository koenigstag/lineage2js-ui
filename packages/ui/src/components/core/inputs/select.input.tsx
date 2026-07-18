import type { ChangeEvent } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectInputProps {
  options: SelectOption[];
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function SelectInput({ options, value, placeholder, disabled, onChange }: SelectInputProps) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
      style={{
        width: "100%",
        boxSizing: "border-box",
        background: "#1e1e1e",
        color: "#999999",
        border: "1px solid #666666",
        borderRadius: 4,
        padding: "6px 8px",
      }}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
