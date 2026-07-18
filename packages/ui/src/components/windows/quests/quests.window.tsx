import { Window } from "../core/window.component";

export interface QuestsWindowProps {
  open: boolean;
  onClose?: () => void;
}

export function QuestsWindow({ open, onClose }: QuestsWindowProps) {
  return (
    <Window id="quests" open={open} onClose={onClose}>
      {() => null}
    </Window>
  );
}
