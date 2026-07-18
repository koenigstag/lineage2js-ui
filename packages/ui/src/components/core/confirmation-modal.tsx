import { useState, type ReactNode } from "react";
import { BaseButton } from "./buttons/base.button";
import { MODAL_Z_INDEX } from "../../config/z-index";

export interface ConfirmationModalProps {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({ open, message, onConfirm, onCancel }: ConfirmationModalProps) {
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
          <BaseButton onClick={onCancel}>Cancel</BaseButton>
          <BaseButton onClick={onConfirm}>Confirm</BaseButton>
        </div>
      </div>
    </div>
  );
}

interface ConfirmationState {
  message: string;
  resolve: (confirmed: boolean) => void;
}

export function useConfirmation(): { confirm: (message: string) => Promise<boolean>; modal: ReactNode } {
  const [state, setState] = useState<ConfirmationState | null>(null);

  function confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => setState({ message, resolve }));
  }

  function handleConfirm() {
    state?.resolve(true);
    setState(null);
  }

  function handleCancel() {
    state?.resolve(false);
    setState(null);
  }

  const modal = (
    <ConfirmationModal open={state !== null} message={state?.message ?? ""} onConfirm={handleConfirm} onCancel={handleCancel} />
  );

  return { confirm, modal };
}
