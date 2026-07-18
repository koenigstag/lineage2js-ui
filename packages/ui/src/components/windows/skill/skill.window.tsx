import { Window } from "../core/window.component";

export interface SkillWindowProps {
  open: boolean;
  onClose?: () => void;
}

export function SkillWindow({ open, onClose }: SkillWindowProps) {
  return (
    <Window id="skill" open={open} onClose={onClose}>
      {() => null}
    </Window>
  );
}
