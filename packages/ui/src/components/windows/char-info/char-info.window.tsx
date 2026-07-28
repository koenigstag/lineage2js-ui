import { observer } from "mobx-react-lite";
import { StatBar } from "../../core/stat-bar.component";
import { useGameStore } from "../../../stores/StoreContext";
import { t } from "../../../lang/lang";

const BAR_WIDTH = 220;
const BAR_HEIGHT = 16;

const CP_COLOR = "linear-gradient(180deg, #ffd76a 0%, #ff8c00 100%)";
const HP_COLOR = "linear-gradient(180deg, #ff7a6e 0%, #c22b1f 100%)";
const MP_COLOR = "linear-gradient(180deg, #6ea9ff 0%, #1f4fc2 100%)";
const VITALITY_COLOR = "linear-gradient(180deg, #9acd32 0%, #4c6b1a 100%)";

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
        label={t("charSelect.hp")}
        text={`${info.hp}/${info.maxHp}`}
        width={BAR_WIDTH}
        height={BAR_HEIGHT}
      />
      <StatBar
        percent={(info.mp / info.maxMp) * 100}
        color={MP_COLOR}
        label={t("charSelect.mp")}
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
