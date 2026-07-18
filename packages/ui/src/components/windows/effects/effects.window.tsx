import { Window } from "../core/window.component";

export interface EffectsWindowProps {
  open: boolean;
  onClose?: () => void;
}

export function EffectsWindow({ open, onClose }: EffectsWindowProps) {
  return (
    <Window id="effects" open={open} onClose={onClose}>
      {() => null}
    </Window>
  );
}
