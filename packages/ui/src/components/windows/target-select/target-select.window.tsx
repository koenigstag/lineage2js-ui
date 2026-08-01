import type { CSSProperties } from "react";
import { observer } from "mobx-react-lite";
import { StatBar } from "../../core/stat-bar.component";
import { Slot } from "../core/slot.component";
import { CreatureKindIcon } from "../../core/creature-kind-icon.component";
import { CreatureRaceIcon } from "../../core/creature-race-icon.component";
import { useGameStore } from "../../../stores/StoreContext";
import { HP_COLOR } from "../../../config/stat-colors";
import { getSkillSlotContent } from "../../../config/skill-mapping";
import { getTargetLevelColor } from "../../../config/target-level-color";
import { t } from "../../../lang/lang";
import { BUFF_ICON_SIZE } from "../effects/effects.window";

const BAR_WIDTH = 200;
const BAR_HEIGHT = 14;

const infoRowStyle = { color: "#a99a7a", fontSize: 11 };

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: -2,
  right: 0,
  background: "transparent",
  border: "none",
  color: "#a59e84",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  padding: "0 2px",
};

const levelBadgeStyle = {
  width: 20,
  height: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#1a1a1a",
  border: "1px solid #6f5c31",
  color: "#e6d9be",
  fontSize: 11,
  fontWeight: "bold" as const,
};

// Shows whatever is currently targeted (attack/spell/buff target): [creature
// icon +] name, HP bar, [title/clan/ally if a player], effects -- see
// GameStore.selectTarget/target and windows-root.tsx's hide-when-empty check.
export const TargetSelectContent = observer(function TargetSelectContent() {
  const game = useGameStore();
  const target = game.target;

  if (!target) {
    return null;
  }

  // Con-color is a "is this monster worth fighting" signal -- doesn't apply
  // to quest-giver/functional NPCs, siege weapons (catapults etc, even though
  // they're technically attackable), or summons/pets.
  const isConColored = target.level !== undefined && target.creatureKind === "mob" && target.race !== "SIEGE_WEAPON";

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 4, width: BAR_WIDTH }}>
      <button
        type="button"
        onClick={() => game.clearTarget()}
        style={closeButtonStyle}
        aria-label={t("common.cancel")}
      >
        ×
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 4, paddingRight: 14 }}>
        {target.level !== undefined && <div style={levelBadgeStyle}>{target.level}</div>}
        {target.race ? (
          <CreatureRaceIcon race={target.race} />
        ) : (
          target.creatureKind && <CreatureKindIcon kind={target.creatureKind} />
        )}
        <span
          style={{
            color: isConColored ? getTargetLevelColor(game.charInfo.level, target.level!) : "#e6d9be",
            fontSize: 13,
          }}
        >
          {target.name}
        </span>
      </div>
      <StatBar
        percent={(target.hp / target.maxHp) * 100}
        color={HP_COLOR}
        label={t("charInfo.hp")}
        text={`${target.hp}/${target.maxHp}`}
        width={BAR_WIDTH}
        height={BAR_HEIGHT}
      />
      <div style={infoRowStyle}>
        {t("targetSelect.isAlive")}: {target.isDead ? t("targetSelect.dead") : t("targetSelect.alive")}
      </div>
      {target.title && <div style={infoRowStyle}>{t("targetSelect.status")}: {target.title}</div>}
      {target.clanName && <div style={infoRowStyle}>{t("targetSelect.clan")}: {target.clanName}</div>}
      {target.allyName && <div style={infoRowStyle}>{t("targetSelect.ally")}: {target.allyName}</div>}
      {target.buffs.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          {target.buffs.map((buff) => (
            <Slot
              key={buff.Id}
              type="inventory"
              size={BUFF_ICON_SIZE}
              content={getSkillSlotContent({
                id: buff.Id,
                level: buff.SkillLevel,
                expiresAt: Date.now() + buff.RemainingTime * 1000,
              })}
            />
          ))}
        </div>
      )}
    </div>
  );
});
