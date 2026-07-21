import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { ServerStatus, type L2Server } from "@lineage2js/network";
import { BaseButton } from "../../core/buttons/base.button";
import { useAlert } from "../../core/alert-modal";
import { useSessionStore } from "../../../stores/StoreContext";
import { MENU_Z_INDEX } from "../../../config/z-index";

// The login protocol has no server display name -- only an Id. Real L2
// clients ship a client-side ServerId -> name mapping; this app only knows
// the one demo server for now.
const SERVER_ID_NAMES: Record<number, string> = {
  1: "Bartz",
};

function serverName(server: L2Server): string {
  return SERVER_ID_NAMES[server.Id] ?? `Server ${server.Id}`;
}

function statusColor(status: ServerStatus): string {
  switch (status) {
    case ServerStatus.STATUS_GOOD:
      return "#7a9a5c";
    case ServerStatus.STATUS_NORMAL:
      return "#c2a23e";
    case ServerStatus.STATUS_FULL:
    case ServerStatus.STATUS_GM_ONLY:
      return "#a0654f";
    case ServerStatus.STATUS_DOWN:
      return "#555555";
    default:
      return "#7a9a5c";
  }
}

interface ServerSelectMenuProps {
  onConfirm: () => void;
}

export const ServerSelectMenu = observer(function ServerSelectMenu({ onConfirm }: ServerSelectMenuProps) {
  const session = useSessionStore();
  const { alert, modal: alertModal } = useAlert();
  const [selectedId, setSelectedId] = useState<number | undefined>(session.servers[0]?.Id);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  async function handleConfirm() {
    if (selectedId === undefined) {
      return;
    }

    if (await session.selectServer(selectedId)) {
      onConfirm();
    } else {
      await alert(session.error ?? "Could not connect to that server.");
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        zIndex: MENU_Z_INDEX,
        width: 260,
        backgroundColor: "#1a1a1a",
        borderLeft: "1px solid #444444",
        display: "flex",
        flexDirection: "column",
        padding: 16,
        gap: 8,
        transform: visible ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s ease-out",
      }}
    >
      <div style={{ color: "#e8dfc8", fontSize: 16, marginBottom: 8 }}>Select Server</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, overflowY: "auto" }}>
        {session.servers.map((server) => {
          const isSelected = server.Id === selectedId;

          return (
            <div
              key={server.Id}
              onClick={() => setSelectedId(server.Id)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 10px",
                borderRadius: 4,
                cursor: "pointer",
                backgroundColor: isSelected ? "#332a1a" : "#222222",
                border: isSelected ? "1px solid #c2a23e" : "1px solid #333333",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#e0e0e0", fontSize: 14 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: statusColor(server.Status),
                  }}
                />
                {serverName(server)}
              </span>
              <span style={{ color: "#999999", fontSize: 12 }}>
                {server.CurrentPlayers}/{server.MaxPlayers}
              </span>
            </div>
          );
        })}
      </div>

      <BaseButton onClick={handleConfirm} disabled={selectedId === undefined || session.isConnecting}>
        {session.isConnecting ? "Connecting..." : "Confirm"}
      </BaseButton>
      {alertModal}
    </div>
  );
});
