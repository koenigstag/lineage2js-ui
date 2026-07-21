import { observer } from "mobx-react-lite";
import { SelectInput } from "../../core/inputs/select.input";
import { useUiStore } from "../../../stores/StoreContext";
import { LANGS, LANG_LABELS, t, type LANG } from "../../../lang/lang";

const LANG_OPTIONS = (Object.keys(LANGS) as LANG[]).map((lang) => ({
  value: lang,
  label: LANG_LABELS[lang],
}));

export const SettingsContent = observer(function SettingsContent() {
  const ui = useUiStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 200 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 11, color: "#999999" }}>{t("settings.language")}</label>
        <SelectInput options={LANG_OPTIONS} value={ui.lang} onChange={(value) => ui.setLang(value as LANG)} />
      </div>
    </div>
  );
});
