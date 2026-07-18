import type { ReactNode } from "react";

export interface WindowProps {
  id: string;
  open: boolean;
  onClose?: () => void;
  children?: () => ReactNode;
}

export function Window({ id, open, onClose, children }: WindowProps) {
  if (!open) {
    return null;
  }

  return (
    <div id={id} className="window" style={{ position: "absolute" }}>
      {onClose && (
        <button type="button" className="window__close" onClick={onClose}>
          ×
        </button>
      )}
      <div className="window__content">{children?.()}</div>
    </div>
  );
}
