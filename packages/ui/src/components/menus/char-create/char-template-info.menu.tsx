import { getBaseStats, type Race } from "../../../config/character-races";
import { MENU_Z_INDEX } from "../../../config/z-index";

const STAT_LABELS: Array<{ key: keyof ReturnType<typeof getBaseStats>; label: string }> = [
  { key: "str", label: "STR" },
  { key: "dex", label: "DEX" },
  { key: "con", label: "CON" },
  { key: "int", label: "INT" },
  { key: "wit", label: "WIT" },
  { key: "men", label: "MEN" },
];

interface CharTemplateInfoMenuProps {
  race: Race;
}

/** Base stats preview for the race currently focused in the create-char scene. */
export function CharTemplateInfoMenu({ race }: CharTemplateInfoMenuProps) {
  const stats = getBaseStats(race);

  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        zIndex: MENU_Z_INDEX,
        width: 160,
        backgroundColor: "#1a1a1a",
        border: "1px solid #444444",
        borderRadius: 4,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ color: "#e8dfc8", fontSize: 13, marginBottom: 4 }}>Base Stats</div>
      {STAT_LABELS.map(({ key, label }) => (
        <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#cccccc" }}>
          <span>{label}</span>
          <span>{stats[key]}</span>
        </div>
      ))}
    </div>
  );
}
