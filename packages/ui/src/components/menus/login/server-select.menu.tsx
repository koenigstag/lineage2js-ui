import { useEffect, useMemo, useState } from "react";
import { BaseButton } from "../../core/buttons/base.button";
import { MENU_Z_INDEX } from "../../../config/z-index";

interface Server {
  id: string;
  name: string;
  ping: number;
}

const SERVER_NAMES = ["Bartz"];

function generateServers(): Server[] {
  return SERVER_NAMES.map((name, index) => ({
    id: String(index),
    name,
    ping: 18 + Math.floor(Math.random() * 90),
  }));
}

function pingColor(ping: number): string {
  if (ping < 50) return "#7a9a5c";
  if (ping < 100) return "#c2a23e";
  return "#a0654f";
}

interface ServerSelectMenuProps {
  onConfirm: () => void;
}

export function ServerSelectMenu({ onConfirm }: ServerSelectMenuProps) {
  const servers = useMemo(generateServers, []);
  const [selectedId, setSelectedId] = useState<string | undefined>(servers[0]?.id);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

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
        {servers.map((server) => {
          const isSelected = server.id === selectedId;

          return (
            <div
              key={server.id}
              onClick={() => setSelectedId(server.id)}
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
              <span style={{ color: "#e0e0e0", fontSize: 14 }}>{server.name}</span>
              <span style={{ color: pingColor(server.ping), fontSize: 12 }}>{server.ping} ms</span>
            </div>
          );
        })}
      </div>

      <BaseButton onClick={onConfirm} disabled={!selectedId}>
        Confirm
      </BaseButton>
    </div>
  );
}
