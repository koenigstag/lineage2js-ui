import type { CSSProperties } from "react";

const footerStyle: CSSProperties = {
  boxSizing: "border-box",
  padding: "15px 24px",
  textAlign: "center",
  backgroundColor: "rgba(128, 128, 128, 0.2)",
  color: "#8a8a8a",
  textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
  fontSize: 11,
  lineHeight: "15px",
};

export function LegalFooter() {
  return (
    <div style={footerStyle}>
      Lineage® II and Lineage® II: The Chaotic Chronicle are registered trademarks of NCsoft Corporation. All
      rights reserved worldwide. NCsoft® is a trademark of NCsoft Corporation. This is an emulator of the mmorpg
      game, running for informational purposes only.
    </div>
  );
}
