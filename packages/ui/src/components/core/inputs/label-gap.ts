/** Space between a field's label and the field itself, shared so the two input kinds line up. */
export const LABEL_GAP = 10;

/**
 * Width of the label column.
 *
 * Fixed rather than sized to the longest label: with `max-content` the
 * column moves whenever the wording does, so two panels side by side start
 * their inputs in different places and neither reads as a column. A label
 * longer than this is clipped rather than allowed to push the field.
 */
export const LABEL_WIDTH = 80;
