import { observer } from "mobx-react-lite";
import { Slot } from "../core/slot.component";
import { useGameStore } from "../../../stores/StoreContext";
import { getSkillIconUrl } from "../../../config/icon-urls";
import { getSkillName } from "../../../config/skill-mapping";
import { t } from "../../../lang/lang";

const SLOT_SIZE = 34;
const BUFF_ICON_SIZE = SLOT_SIZE / 2;
const SLOT_GAP = 2;

export const EffectsContent = observer(function EffectsContent() {
  const game = useGameStore();

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: SLOT_GAP }}>
      {game.buffs.map((buff) => (
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
              // No cost -- buffs aren't cast by the viewer, MP price isn't relevant here.
              expiresAt: Date.now() + buff.RemainingTime * 1000,
              id: buff.Id,
            },
          }}
        />
      ))}
    </div>
  );
});
