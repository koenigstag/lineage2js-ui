import { Window } from "../core/window.component";

export interface BattlelogWindowProps {
  open: boolean;
  onClose?: () => void;
}

export function BattlelogWindow({ open, onClose }: BattlelogWindowProps) {
  return (
    <Window id="battlelog" open={open} onClose={onClose}>
      {() => null}
    </Window>
  );
}
