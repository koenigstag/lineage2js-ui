import { observer } from "mobx-react-lite";
import { t } from "../../../lang/lang";

export const Paperdoll = observer(function Paperdoll() {
  return (
    <div
      style={{
        width: 120,
        height: 240,
        border: "1px solid #666666",
        backgroundColor: "#111111",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#666666",
        fontSize: 11,
        flexShrink: 0,
      }}
    >
      {t("inventory.paperdollLabel")}
    </div>
  );
});
