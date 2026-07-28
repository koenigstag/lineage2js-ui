import { observer } from "mobx-react-lite";
import { Slot } from "../core/slot.component";
import { BaseButton } from "../../core/buttons/base.button";
import { useGameStore, useWindowManagerStore } from "../../../stores/StoreContext";
import { getSkillIconUrl, getItemIconUrl } from "../../../config/icon-urls";
import { getSkillName } from "../../../config/skill-mapping";
import { getItemName } from "../../../config/item-mapping";
import { t } from "../../../lang/lang";

const WIDTH = 220;

const infoRowStyle = { color: "#a99a7a", fontSize: 12 };

// Detail window for a skills-list "Learn" tab entry -- see
// GameStore.selectedLearnableSkill/learnSelectedSkill and
// windows-root.tsx's hide-when-empty check.
export const SkillLearnContent = observer(function SkillLearnContent() {
  const game = useGameStore();
  const windowManager = useWindowManagerStore();
  const skill = game.selectedLearnableSkill;

  if (!skill) {
    return null;
  }

  const hasItem = !skill.requiredItem || game.hasRequiredItem(skill.requiredItem);
  const canLearn = game.charInfo.sp >= skill.costSp && hasItem;

  function handleClose() {
    windowManager.close("skill");
    game.clearSelectedLearnableSkill();
  }

  function handleLearn() {
    game.learnSelectedSkill();
    // learnSelectedSkill() only clears selectedLearnableSkill on success.
    if (!game.selectedLearnableSkill) {
      windowManager.close("skill");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: WIDTH }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Slot
          type="inventory"
          content={{
            type: "skill",
            data: skill,
            iconUrl: getSkillIconUrl(skill.id),
            tooltip: {
              kind: "skill",
              name: getSkillName({ Id: skill.id }),
              stats: t("skills.learn.level", { level: skill.level }),
              id: skill.id,
            },
          }}
        />
        <span style={{ color: "#e6d9be", fontSize: 13 }}>{getSkillName({ Id: skill.id })}</span>
      </div>
      <div style={infoRowStyle}>{t("skills.learn.level", { level: skill.level })}</div>
      <div style={infoRowStyle}>{t("skills.learn.requiredLevel", { level: skill.minLevel })}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={infoRowStyle}>{t("skills.learn.availableSp", { sp: game.charInfo.sp })}</div>
        <div style={infoRowStyle}>{t("skills.learn.requiredSp", { sp: skill.costSp })}</div>
        {skill.requiredItem && (
          <>
            <div style={infoRowStyle}>{t("skills.learn.requiredItem")}</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={hasItem ? undefined : { filter: "blur(2px) grayscale(1)" }}>
                <Slot
                  type="inventory"
                  content={{
                    type: "item-misc",
                    data: skill.requiredItem,
                    count: skill.requiredItem.count,
                    iconUrl: getItemIconUrl(skill.requiredItem.id),
                    tooltip: {
                      kind: "item",
                      name: getItemName({ Id: skill.requiredItem.id }),
                      type: "item-misc",
                      id: skill.requiredItem.id,
                      count: skill.requiredItem.count,
                    },
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        <BaseButton onClick={handleLearn} disabled={!canLearn}>
          {t("skills.learn.learnButton")}
        </BaseButton>
        <BaseButton onClick={handleClose}>{t("skills.learn.closeButton")}</BaseButton>
      </div>
    </div>
  );
});
