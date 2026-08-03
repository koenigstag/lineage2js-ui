import { observer } from "mobx-react-lite";
import { ActionSlot } from "../core/action-slot.component";
import { USER_ACTIONS, type ActionCategory, type Action } from "../../../config/user-actions";
import { useGameStore } from "../../../stores/StoreContext";
import { t } from "../../../lang/lang";

const CATEGORY_ORDER: ActionCategory[] = ["basic", "party", "target", "social", "pet"];

const SLOT_SIZE = 34;
const SLOT_GAP = 2;
const ACTIONS_PER_ROW = 6;
// Constrains the flex row to exactly ACTIONS_PER_ROW columns -- flexWrap
// then breaks onto a new line once that width is exceeded, same technique
// as HOTBAR_WIDTH in windows.registry.ts.
const ROW_WIDTH = ACTIONS_PER_ROW * SLOT_SIZE + (ACTIONS_PER_ROW - 1) * SLOT_GAP;

export const ActionsContent = observer(function ActionsContent() {
  const game = useGameStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {CATEGORY_ORDER.map((category) => (
        <div key={category}>
          <div style={{ fontSize: 12, color: "#c8b892", marginBottom: 4 }}>
            {t(`actions.categories.${category}`)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: SLOT_GAP, width: ROW_WIDTH }}>
            {USER_ACTIONS[category].map((action: Action) => {
              // Most entries have no click dispatch wired yet (see Action's
              // own doc comment) -- only ones with `dispatch` set are clickable here.
              // Dimming always reflects the server's actual allowed-action
              // list (ExBasicActionList), e.g. a transform's restricted
              // action set -- isEnabled (if set) is a separate click-time
              // guard, not part of this visual state (see Action's doc comment).
              const enabled = game.isBasicActionAllowed(action.code);
              const canDispatch = !action.isEnabled || action.isEnabled(game);

              return (
                <ActionSlot
                  key={action.code}
                  code={action.code}
                  category={category}
                  disabled={!enabled}
                  onClick={action.dispatch ? () => canDispatch && action.dispatch!(game) : undefined}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});
