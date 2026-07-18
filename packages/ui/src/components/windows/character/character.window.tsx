import { Window } from "../core/window.component";

export interface CharacterWindowProps {
  open: boolean;
  onClose?: () => void;
}

export function CharacterWindow({ open, onClose }: CharacterWindowProps) {
  return (
    <Window id="character" open={open} onClose={onClose}>
      {() => null}
    </Window>
  );
}
