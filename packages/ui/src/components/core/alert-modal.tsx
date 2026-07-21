import { useState, type ReactNode } from "react";
import { BaseButton } from "./buttons/base.button";
import { MODAL_Z_INDEX } from "../../config/z-index";

export interface AlertModalProps {
  open: boolean;
  message: string;
  onClose: () => void;
}

export function AlertModal({ open, message, onClose }: AlertModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: MODAL_Z_INDEX,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minWidth: 280,
          backgroundColor: "#1a1a1a",
          border: "1px solid #444444",
          borderRadius: 4,
          padding: 20,
        }}
      >
        <span style={{ color: "#cccccc" }}>{message}</span>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <BaseButton onClick={onClose}>OK</BaseButton>
        </div>
      </div>
    </div>
  );
}

interface AlertState {
  message: string;
  resolve: () => void;
}

export function useAlert(): { alert: (message: string) => Promise<void>; modal: ReactNode } {
  const [state, setState] = useState<AlertState | null>(null);

  function alert(message: string): Promise<void> {
    return new Promise((resolve) => setState({ message, resolve }));
  }

  function handleClose() {
    state?.resolve();
    setState(null);
  }

  const modal = <AlertModal open={state !== null} message={state?.message ?? ""} onClose={handleClose} />;

  return { alert, modal };
}
