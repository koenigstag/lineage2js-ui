import { Window } from "../core/window.component";

export interface QuestInfoWindowProps {
  open: boolean;
  onClose?: () => void;
}

export function QuestInfoWindow({ open, onClose }: QuestInfoWindowProps) {
  return (
    <Window id="quest-info" open={open} onClose={onClose}>
      {() => null}
    </Window>
  );
}
