import { observer } from "mobx-react-lite";
import { StatBar } from "../../core/stat-bar.component";
import { Slot } from "../core/slot.component";
import { CreatureKindIcon } from "../../core/creature-kind-icon.component";
import { useGameStore } from "../../../stores/StoreContext";
import { HP_COLOR } from "../../../config/stat-colors";
import { getSkillIconUrl } from "../../../config/icon-urls";
import { getSkillName } from "../../../config/skill-mapping";
import { t } from "../../../lang/lang";
import { BUFF_ICON_SIZE } from "../effects/effects.window";

const BAR_WIDTH = 200;
const BAR_HEIGHT = 14;

const infoRowStyle = { color: "#a99a7a", fontSize: 11 };

// Shows whatever is currently targeted (attack/spell/buff target): [creature
// icon +] name, HP bar, [title/clan/ally if a player], effects -- see
// GameStore.selectTarget/target and windows-root.tsx's hide-when-empty check.
export const TargetSelectContent = observer(function TargetSelectContent() {
  const game = useGameStore();
  const target = game.target;

  if (!target) {
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: BAR_WIDTH }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {target.creatureKind && <CreatureKindIcon kind={target.creatureKind} />}
        <span style={{ color: "#e6d9be", fontSize: 13 }}>{target.name}</span>
      </div>
      <StatBar
        percent={(target.hp / target.maxHp) * 100}
        color={HP_COLOR}
        label={t("charInfo.hp")}
        text={`${target.hp}/${target.maxHp}`}
        width={BAR_WIDTH}
        height={BAR_HEIGHT}
      />
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
              content={{
                type: "skill",
                data: buff,
                iconUrl: getSkillIconUrl(buff.Id),
                tooltip: {
                  kind: "skill",
                  name: getSkillName(buff),
                  stats: t("tooltip.levelLabel", { level: buff.SkillLevel }),
                  expiresAt: Date.now() + buff.RemainingTime * 1000,
                  id: buff.Id,
                },
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
});
