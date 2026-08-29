import type { CSSProperties, ReactNode } from "react";
import { LABEL_GAP } from "./label-gap";

export interface FieldGridProps {
  children: ReactNode;
  /** Vertical space between rows; matches whatever the surrounding panel uses. */
  rowGap?: number;
  style?: CSSProperties;
}

/**
 * Lines a form's labelled fields up in two columns.
 *
 * A label set beside its field has to share a column width with the labels
 * above and below it, or every control starts at a different place -- "Name"
 * and "Hair Color" are not the same length, and in another language neither is
 * the same length again. `max-content` takes that width from the longest label
 * there actually is, so the column is never wider than it needs to be; the
 * labels range right within it, against the fields they name.
 *
 * The labelled inputs collapse their own wrapper with `display: contents` so
 * their two halves land in these columns directly. Anything else put in here
 * -- a row of buttons, say -- should span both.
 */
export function FieldGrid({ children, rowGap = 8, style }: FieldGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "max-content 1fr",
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
