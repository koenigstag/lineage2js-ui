import { StatBar } from "./stat-bar.component";
import { CP_COLOR, HP_COLOR, MP_COLOR, VITALITY_COLOR } from "../../config/stat-colors";
import { VITALITY_LEVEL_MARKERS } from "../../stores/GameStore";
import { t } from "../../lang/lang";

export interface CharacterVitalsProps {
  name: string;
  /** Omit to hide the level badge (e.g. char-select's CharSelectionInfo doesn't carry it consistently). */
  level?: number;
  /** Omit (along with maxCp) to hide the CP bar -- e.g. CharSelectionInfo doesn't parse CP. */
  cp?: number;
  maxCp?: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  /** Omit to hide the Vitality bar. */
  vitalityPercent?: number;
  width?: number;
  height?: number;
}

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

/** Shared name/level + CP/HP/MP/Vitality bars, used by both the game screen's char-info window and the char-select menu. */
export function CharacterVitals({
  name,
  level,
  cp,
  maxCp,
  hp,
  maxHp,
  mp,
  maxMp,
  vitalityPercent,
  width = 220,
  height = 16,
}: CharacterVitalsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {level !== undefined && <div style={levelBadgeStyle}>{level}</div>}
        <div style={{ color: "#e6d9be", fontSize: 13 }}>{name}</div>
      </div>
      {maxCp !== undefined && cp !== undefined && (
        <StatBar
          percent={(cp / maxCp) * 100}
          color={CP_COLOR}
          label={t("charInfo.cp")}
          text={`${cp}/${maxCp}`}
          width={width}
          height={height}
        />
      )}
      <StatBar
        percent={(hp / maxHp) * 100}
        color={HP_COLOR}
        label={t("charInfo.hp")}
        text={`${hp}/${maxHp}`}
        width={width}
        height={height}
      />
      <StatBar
        percent={(mp / maxMp) * 100}
        color={MP_COLOR}
        label={t("charInfo.mp")}
        text={`${mp}/${maxMp}`}
        width={width}
        height={height}
      />
      {vitalityPercent !== undefined && (
        <StatBar
          percent={vitalityPercent}
          color={VITALITY_COLOR}
          label={t("charInfo.vp")}
          width={width}
          height={height}
          dividers={VITALITY_LEVEL_MARKERS}
        />
      )}
    </div>
  );
}
