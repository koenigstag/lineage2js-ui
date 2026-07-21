import { observer } from "mobx-react-lite";
import { useSessionStore } from "../../../stores/StoreContext";
import { getTemplateStats } from "../../../config/network-mapping";
import { type BaseClass, type BaseStats, type Race, type Sex } from "../../../config/character-races";
import { MENU_Z_INDEX } from "../../../config/z-index";
import { t } from "../../../lang/lang";

const STAT_KEYS: Array<keyof BaseStats> = ["str", "dex", "con", "int", "wit", "men"];

interface CharTemplateInfoMenuProps {
  race: Race;
  baseClass: BaseClass;
  sex: Sex;
}

/** Base stats preview for the race/class/sex currently focused in the create-char scene, from the real server template when available. */
export const CharTemplateInfoMenu = observer(function CharTemplateInfoMenu({
  race,
  baseClass,
  sex,
}: CharTemplateInfoMenuProps) {
  const session = useSessionStore();
  const stats = getTemplateStats(session.characterTemplates, race, baseClass, sex);

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
      <div style={{ color: "#e8dfc8", fontSize: 13, marginBottom: 4 }}>{t("charCreate.baseStatsTitle")}</div>
      {STAT_KEYS.map((key) => (
        <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#cccccc" }}>
          <span>{t(`charCreate.stat.${key}`)}</span>
          <span>{stats[key]}</span>
        </div>
      ))}
    </div>
  );
});
