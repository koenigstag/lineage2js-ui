import { Window } from "../core/window.component";

export interface InventoryWindowProps {
  open: boolean;
  onClose?: () => void;
}

export function InventoryWindow({ open, onClose }: InventoryWindowProps) {
  return (
    <Window id="inventory" open={open} onClose={onClose}>
      {() => null}
    </Window>
  );
}
