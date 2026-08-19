import { observer } from "mobx-react-lite";
import { BaseButton } from "../../core/buttons/base.button";
import { useWindowManagerStore } from "../../../stores/StoreContext";
import { MENU_Z_INDEX } from "../../../config/z-index";
import { t } from "../../../lang/lang";

export const TitleMenu = observer(function TitleMenu() {
  const windowManager = useWindowManagerStore();

  return (
    <div
      style={{
        position: "absolute",
        bottom: 10,
        right: 10,
        zIndex: MENU_Z_INDEX,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        backgroundColor: "#1a1a1a",
        border: "1px solid #444444",
        borderRadius: 4,
        padding: 12,
      }}
    >
      <BaseButton href={import.meta.env.VITE_REGISTER_URL}>{t("titleMenu.newAccount")}</BaseButton>
      <BaseButton href={import.meta.env.VITE_RESTORE_PASSWORD_URL}>{t("titleMenu.lostAccount")}</BaseButton>
      <BaseButton href={import.meta.env.VITE_WIKI_URL}>{t("titleMenu.wikiPortal")}</BaseButton>
      <BaseButton onClick={() => windowManager.toggle("settings")}>{t("common.settings")}</BaseButton>
    </div>
  );
});
