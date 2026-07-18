import { Window } from "../core/window.component";

export interface SkillsWindowProps {
  open: boolean;
  onClose?: () => void;
}

export function SkillsWindow({ open, onClose }: SkillsWindowProps) {
  return (
    <Window id="skills" open={open} onClose={onClose}>
      {() => null}
    </Window>
  );
}
