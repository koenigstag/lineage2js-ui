import type { CSSProperties } from "react";

export interface StatBarProps {
  /** 0-100, clamped. */
  percent: number;
  /** Fill color/gradient. */
  color: string;
  /** Shown pinned to the left edge, e.g. "CP"/"HP"/"MP". Omit for an unlabeled bar (e.g. Vitality). */
  label?: string;
  /** Centered text, e.g. "850/1200" or "75%". */
  text?: string;
  width?: number;
  height?: number;
  /** Percentages (0-100) to draw a thin marker line at, e.g. vitality level boundaries. */
  dividers?: number[];
  /** Divider line color, defaults to a faint dark line. */
  dividerColor?: string;
  /** Divider line thickness in px, defaults to 1. */
  dividerWidth?: number;
}

const textStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  color: "#fff",
  textShadow: "0 1px 2px rgba(0, 0, 0, 0.9)",
  fontSize: 11,
  fontFamily: "'Courier Prime', monospace",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  userSelect: "none",
};

/** Reusable labeled fill bar for CP/HP/MP/Vitality-style stats (char-info, party-char-info, ...). */
export function StatBar({
  percent,
  color,
  label,
  text,
  width = 200,
  height = 16,
  dividers,
  dividerColor = "rgba(0, 0, 0, 0.3)",
  dividerWidth = 1,
}: StatBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        backgroundColor: "#101010",
        border: "1px solid #000",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: `${clamped}%`,
          background: color,
        }}
      />
      {dividers?.map((atPercent) => (
        <div
          key={atPercent}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${atPercent}%`,
            width: dividerWidth,
            backgroundColor: dividerColor,
            pointerEvents: "none",
          }}
        />
      ))}
      {label && <span style={{ ...textStyle, left: 4 }}>{label}</span>}
      {text && <span style={{ ...textStyle, left: "50%", transform: "translate(-50%, -50%)", top: "50%" }}>{text}</span>}
    </div>
  );
}

const LABELED_BAR_TEXT_SHADOW = "1px 0.5px 0 rgba(0, 0, 0, 0.9)";

export interface LabeledBarProps {
  /** External label to the left of the bar, e.g. "SP"/"WG" -- distinct from StatBar's own optional pinned-inside label. */
  label: string;
  percent: number;
  text?: string;
  color: string;
  width: number;
  /** Fixed width of the label column. Defaults to 20px (fits "HP"/"MP"/"SP"-style 2-3 char labels). */
  labelWidth?: number;
  dividers?: number[];
}

/** Reusable label-plus-StatBar row (char-info, party-char-info, inventory's Adena/WG row, ...). */
export function LabeledBar({ label, percent, text, color, width, labelWidth = 20, dividers }: LabeledBarProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
      <span style={{ color: "#d2d2d2", fontSize: 11, width: labelWidth, flexShrink: 0, textShadow: LABELED_BAR_TEXT_SHADOW }}>
        {label}
      </span>
      <StatBar percent={percent} color={color} text={text} width={width} height={13} dividers={dividers} />
    </div>
  );
}
