import { observer } from "mobx-react-lite";
import { Slot } from "../core/slot.component";
import { getActionIconUrl } from "../../../config/icon-urls";
import { USER_ACTIONS, getActionName, type ActionCategory, type Action } from "../../../config/user-actions";
import { t } from "../../../lang/lang";

const CATEGORY_ORDER: ActionCategory[] = ["basic", "party", "target", "social", "pet"];

const SLOT_SIZE = 34;
const SLOT_GAP = 2;
const ACTIONS_PER_ROW = 6;
// Constrains the flex row to exactly ACTIONS_PER_ROW columns -- flexWrap
// then breaks onto a new line once that width is exceeded, same technique
// as HOTBAR_WIDTH in windows.registry.ts.
const ROW_WIDTH = ACTIONS_PER_ROW * SLOT_SIZE + (ACTIONS_PER_ROW - 1) * SLOT_GAP;

function getActionSlotType(category: ActionCategory): "action" | "pet-action" {
  return category === "pet" ? "pet-action" : "action";
}

export const ActionsContent = observer(function ActionsContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {CATEGORY_ORDER.map((category) => (
        <div key={category}>
          <div style={{ fontSize: 12, color: "#c8b892", marginBottom: 4 }}>
            {t(`actions.categories.${category}`)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: SLOT_GAP, width: ROW_WIDTH }}>
            {USER_ACTIONS[category].map((action: Action) => (
              <Slot
                key={action.code}
                type="hotbar"
                content={{
                  type: getActionSlotType(category),
                  data: action,
                  iconUrl: getActionIconUrl(action.code),
                  tooltip: { kind: "simple", name: getActionName(action) },
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});
