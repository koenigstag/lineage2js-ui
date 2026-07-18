import { Window } from "../core/window.component";

export interface MapWindowProps {
  open: boolean;
  onClose?: () => void;
}

export function MapWindow({ open, onClose }: MapWindowProps) {
  return (
    <Window id="map" open={open} onClose={onClose}>
      {() => null}
    </Window>
  );
}
