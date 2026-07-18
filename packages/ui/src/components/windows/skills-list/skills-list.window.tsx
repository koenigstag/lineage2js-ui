import { Window } from "../core/window.component";

export interface SkillsListWindowProps {
  open: boolean;
  onClose?: () => void;
}

export function SkillsListWindow({ open, onClose }: SkillsListWindowProps) {
  return (
    <Window id="skills-list" open={open} onClose={onClose}>
      {() => null}
    </Window>
  );
}
