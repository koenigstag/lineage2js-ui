import { Window } from "../core/window.component";

export interface ActionsWindowProps {
  open: boolean;
  onClose?: () => void;
}

export function ActionsWindow({ open, onClose }: ActionsWindowProps) {
  return (
    <Window id="actions" open={open} onClose={onClose}>
      {() => null}
    </Window>
  );
}
