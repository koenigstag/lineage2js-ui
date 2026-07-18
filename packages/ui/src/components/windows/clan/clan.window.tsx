import { Window } from "../core/window.component";

export interface ClanWindowProps {
  open: boolean;
  onClose?: () => void;
}

export function ClanWindow({ open, onClose }: ClanWindowProps) {
  return (
    <Window id="clan" open={open} onClose={onClose}>
      {() => null}
    </Window>
  );
}
