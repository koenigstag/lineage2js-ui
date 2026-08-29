import type { CSSProperties, ReactNode } from "react";
import { LABEL_GAP, LABEL_WIDTH } from "./label-gap";

export interface FieldGridProps {
  children: ReactNode;
  /** Vertical space between rows; matches whatever the surrounding panel uses. */
  rowGap?: number;
  /** Width of the label column, for a panel whose wording needs more or less than the default. */
  labelWidth?: number;
  style?: CSSProperties;
}

/**
 * Lines a form's labelled fields up in two columns.
 *
 * A label set beside its field has to share a column width with the labels
 * above and below it, or every control starts at a different place -- "Name"
 * and "Hair Color" are not the same length. The column is a fixed width so
 * that holds across panels too, not just within one.
 *
 * The labelled inputs collapse their own wrapper with `display: contents` so
 * their two halves land in these columns directly. Anything else put in here
 * -- a row of buttons, say -- should span both.
 */
export function FieldGrid({ children, rowGap = 8, labelWidth = LABEL_WIDTH, style }: FieldGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `${String(labelWidth)}px 1fr`,
        columnGap: LABEL_GAP,
        rowGap,
        alignItems: "center",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
