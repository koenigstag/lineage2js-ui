import { observer } from "mobx-react-lite";
import { Slot, type IconBorder } from "../core/slot.component";
import { getActionIconUrl } from "../../../config/icon-urls";
import { USER_ACTIONS, getActionName, type ActionCategory, type Action } from "../../../config/user-actions";
import { t } from "../../../lang/lang";

const CATEGORY_ORDER: ActionCategory[] = ["basic", "party", "target", "social", "pet"];

const ACTION_ICON_BORDER: IconBorder = { from: "#7f9faf", to: "#31576f" };

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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
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
                iconBorder={ACTION_ICON_BORDER}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});
