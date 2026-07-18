import { Window } from "../core/window.component";

export interface RadarWindowProps {
  open: boolean;
  onClose?: () => void;
}

export function RadarWindow({ open, onClose }: RadarWindowProps) {
  return (
    <Window id="radar" open={open} onClose={onClose}>
      {() => null}
    </Window>
  );
}
