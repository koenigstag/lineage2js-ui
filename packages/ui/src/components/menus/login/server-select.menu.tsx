import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { ServerStatus, type L2Server } from "@lineage2js/network";
import { BaseButton } from "../../core/buttons/base.button";
import { useAlert } from "../../core/alert-modal";
import { useSessionStore } from "../../../stores/StoreContext";
import { MENU_Z_INDEX } from "../../../config/z-index";
import { t } from "../../../lang/lang";

// The login protocol has no server display name -- only an Id. Real L2
// clients ship a client-side ServerId -> name mapping; this app only knows
// the one demo server for now. A proper noun, so left untranslated like any
// other server's real name would be.
const SERVER_ID_NAMES: Record<number, string> = {
  1: "Bartz",
};

function serverName(server: L2Server): string {
  return SERVER_ID_NAMES[server.Id] ?? t("serverSelect.serverPrefix", { id: server.Id });
}

function pingLabel(ms: number | null | undefined): string {
  if (ms === undefined) return t("serverSelect.pinging");
  if (ms === null) return t("serverSelect.unreachable");
  return `${Math.round(ms)}${t("serverSelect.msSuffix")}`;
}

function pingColor(ms: number | null | undefined): string {
  if (ms === undefined) return "#666666";
  if (ms === null) return "#a0654f";
  if (ms < 80) return "#7a9a5c";
  if (ms < 200) return "#c2a23e";
  return "#a0654f";
}

// Still-pinging/unreachable servers sink to the bottom instead of jumping
// around as their real ping resolves.
function pingSortValue(ms: number | null | undefined): number {
  return typeof ms === "number" ? ms : Infinity;
}

type SortMode = "default" | "ping" | "slots";

const SORT_OPTIONS: Array<{ mode: SortMode; labelKey: string }> = [
  { mode: "default", labelKey: "serverSelect.sortDefault" },
  { mode: "ping", labelKey: "serverSelect.sortByPing" },
  { mode: "slots", labelKey: "serverSelect.sortByFreeSlots" },
];

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
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const sortedServers =
    sortMode === "ping"
      ? [...session.servers].sort(
          (a, b) => pingSortValue(session.serverPings[a.Id]) - pingSortValue(session.serverPings[b.Id])
        )
      : sortMode === "slots"
      ? [...session.servers].sort(
          (a, b) => b.MaxPlayers - b.CurrentPlayers - (a.MaxPlayers - a.CurrentPlayers)
        )
      : session.servers;

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
      await alert(session.error ?? t("serverSelect.connectFailed"));
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          position: "relative",
        }}
      >
        <span style={{ color: "#e8dfc8", fontSize: 16 }}>{t("serverSelect.title")}</span>

        <button
          type="button"
          onClick={() => setSortMenuOpen((open) => !open)}
          title={t("serverSelect.sortTooltip")}
          style={{
            background: "none",
            border: "1px solid #444444",
            borderRadius: 4,
            color: "#999999",
            cursor: "pointer",
            padding: "2px 6px",
            fontSize: 14,
            lineHeight: 1.4,
          }}
        >
          ⇅
        </button>

        {sortMenuOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: 4,
              zIndex: MENU_Z_INDEX + 1,
              backgroundColor: "#222222",
              border: "1px solid #444444",
              borderRadius: 4,
              overflow: "hidden",
              minWidth: 130,
            }}
          >
            {SORT_OPTIONS.map((option) => (
              <div
                key={option.mode}
                onClick={() => {
                  setSortMode(option.mode);
                  setSortMenuOpen(false);
                }}
                style={{
                  padding: "6px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                  color: option.mode === sortMode ? "#e8dfc8" : "#999999",
                  backgroundColor: option.mode === sortMode ? "#332a1a" : "transparent",
                }}
              >
                {t(option.labelKey)}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, overflowY: "auto" }}>
        {sortedServers.map((server) => {
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
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#999999", fontSize: 12 }}>
                  {server.CurrentPlayers}/{server.MaxPlayers}
                </span>
                <span style={{ color: pingColor(session.serverPings[server.Id]), fontSize: 12, minWidth: 34, textAlign: "right" }}>
                  {pingLabel(session.serverPings[server.Id])}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <BaseButton onClick={handleConfirm} disabled={selectedId === undefined || session.isConnecting}>
        {session.isConnecting ? t("common.connecting") : t("common.confirm")}
      </BaseButton>
      {alertModal}
    </div>
  );
});
