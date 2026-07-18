import { Window } from "../core/window.component";

export interface HotbarWindowProps {
  open: boolean;
  onClose?: () => void;
}

export function HotbarWindow({ open, onClose }: HotbarWindowProps) {
  return (
    <Window id="hotbar" open={open} onClose={onClose}>
      {() => null}
    </Window>
  );
}
