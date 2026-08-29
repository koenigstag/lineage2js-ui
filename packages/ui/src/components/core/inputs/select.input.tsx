import type { ChangeEvent } from "react";

/**
 * What an unmade choice reads as, now that the label sits beside the control
 * rather than standing in for it inside. A dash rather than the label again:
 * repeating "Class" inside a field already labelled "Class" says nothing.
 */
const EMPTY_CHOICE = "—";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectInputProps {
  options: SelectOption[];
  value: string;
  /** Set beside the control rather than inside it, on the same line. */
  label?: string;
  /**
   * The entry standing for "nothing chosen yet". It reads as a dash rather
   * than repeating the label above it, and stays disabled: a choice already
   * made is not un-made by picking it again.
   */
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function SelectInput({ options, value, label, placeholder, disabled, onChange }: SelectInputProps) {
  const field = (
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
      {(placeholder || value === "") && (
        <option value="" disabled>
          {placeholder ?? EMPTY_CHOICE}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
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
