import { useEffect, useState, type ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { BaseButton } from "./buttons/base.button";
import { BaseInput } from "./inputs/base.input";
import { MODAL_Z_INDEX } from "../../config/z-index";
import { t } from "../../lang/lang";

export interface ItemCountModalProps {
  open: boolean;
  itemName: string;
  /** Translated verb, e.g. "sell"/"destroy" -- see ItemCountAction. */
  action: string;
  max: number;
  onConfirm: (count: number) => void;
  onCancel: () => void;
}

/** Clamps to a valid [1, max] integer, or undefined if the raw input can't be parsed as one. */
function parseCount(raw: string, max: number): number | undefined {
  const parsed = Math.floor(Number(raw));
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return Math.min(parsed, max);
}

/** 1900 -> "1.9K", 1000 -> "1K", 2500000 -> "2.5M". Below 1000, the exact number. */
function formatCompactCount(count: number): string {
  const units: [number, string][] = [
    [1_000_000, "M"],
    [1_000, "K"],
  ];
  for (const [threshold, suffix] of units) {
    if (count >= threshold) {
      const value = (count / threshold).toFixed(1).replace(/\.0$/, "");
      return `${value}${suffix}`;
    }
  }
  return String(count);
}

export const ItemCountModal = observer(function ItemCountModal({
  open,
  itemName,
  action,
  max,
  onConfirm,
  onCancel,
}: ItemCountModalProps) {
  const [raw, setRaw] = useState(String(max));

  // Reset to the full stack every time a new prompt opens.
  useEffect(() => {
    if (open) setRaw(String(max));
  }, [open, max]);

  if (!open) {
    return null;
  }

  const count = parseCount(raw, max);

  function confirm() {
    if (count !== undefined) onConfirm(count);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: MODAL_Z_INDEX,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
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
        <span style={{ color: "#cccccc", textAlign: "center" }}>{t("inventory.itemCountPrompt", { name: itemName, action })}</span>
        <div style={{ width: "50%", alignSelf: "center", display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ color: "#888888", fontSize: 11, textAlign: "center" }}>
            {count !== undefined ? formatCompactCount(count) : " "}
          </span>
          <BaseInput
            type="number"
            value={raw}
            onChange={setRaw}
            onKeyDown={(event) => event.key === "Enter" && confirm()}
          />
        </div>
        <div style={{ display: "flex", gap: 8, width: "50%", alignSelf: "center" }}>
          <BaseButton onClick={confirm} disabled={count === undefined} style={{ flex: 1 }}>
            {t("common.confirm")}
          </BaseButton>
          <BaseButton onClick={onCancel} style={{ flex: 1 }}>
            {t("common.cancel")}
          </BaseButton>
        </div>
      </div>
    </div>
  );
});

interface ItemCountState {
  itemName: string;
  action: string;
  max: number;
  resolve: (count: number | undefined) => void;
}

/** Same open-a-promise-backed-modal pattern as useConfirmation (confirmation-modal.tsx), for prompting a 1..max item count instead of a plain yes/no. */
export function useItemCountPrompt(): {
  promptCount: (itemName: string, action: string, max: number) => Promise<number | undefined>;
  modal: ReactNode;
} {
  const [state, setState] = useState<ItemCountState | null>(null);

  function promptCount(itemName: string, action: string, max: number): Promise<number | undefined> {
    return new Promise((resolve) => setState({ itemName, action, max, resolve }));
  }

  function handleConfirm(count: number) {
    state?.resolve(count);
    setState(null);
  }

  function handleCancel() {
    state?.resolve(undefined);
    setState(null);
  }

  const modal = (
    <ItemCountModal
      open={state !== null}
      itemName={state?.itemName ?? ""}
      action={state?.action ?? ""}
      max={state?.max ?? 1}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { promptCount, modal };
}
