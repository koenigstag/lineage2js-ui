import { Window } from "../core/window.component";

export interface ChatWindowProps {
  open: boolean;
  onClose?: () => void;
}

export function ChatWindow({ open, onClose }: ChatWindowProps) {
  return (
    <Window id="chat" open={open} onClose={onClose}>
      {() => null}
    </Window>
  );
}
