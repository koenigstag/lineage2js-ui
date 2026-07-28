import { observer } from "mobx-react-lite";
import { StatBar } from "../../core/stat-bar.component";
import { useGameStore } from "../../../stores/StoreContext";
import { CP_COLOR, HP_COLOR, MP_COLOR, VITALITY_COLOR } from "../../../config/stat-colors";
import { t } from "../../../lang/lang";

const BAR_WIDTH = 220;
const BAR_HEIGHT = 16;

const levelBadgeStyle = {
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#1a1a1a",
  border: "1px solid #6f5c31",
  color: "#e6d9be",
  fontSize: 13,
  fontWeight: "bold" as const,
};

export const CharInfoContent = observer(function CharInfoContent() {
  const game = useGameStore();
  const info = game.charInfo;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: BAR_WIDTH }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={levelBadgeStyle}>{info.level}</div>
        <div style={{ color: "#e6d9be", fontSize: 13 }}>{info.name}</div>
      </div>
      <StatBar
        percent={(info.cp / info.maxCp) * 100}
        color={CP_COLOR}
        label={t("charInfo.cp")}
        text={`${info.cp}/${info.maxCp}`}
        width={BAR_WIDTH}
        height={BAR_HEIGHT}
      />
      <StatBar
        percent={(info.hp / info.maxHp) * 100}
        color={HP_COLOR}
        label={t("charInfo.hp")}
        text={`${info.hp}/${info.maxHp}`}
        width={BAR_WIDTH}
        height={BAR_HEIGHT}
      />
      <StatBar
        percent={(info.mp / info.maxMp) * 100}
        color={MP_COLOR}
        label={t("charInfo.mp")}
        text={`${info.mp}/${info.maxMp}`}
        width={BAR_WIDTH}
        height={BAR_HEIGHT}
      />
      <StatBar
        percent={info.vitalityPercent}
        color={VITALITY_COLOR}
        text={`${Math.round(info.vitalityPercent)}%`}
        width={BAR_WIDTH}
        height={BAR_HEIGHT}
      />
    </div>
  );
});
