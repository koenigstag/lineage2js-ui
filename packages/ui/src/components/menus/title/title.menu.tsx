import { BaseButton } from "../../core/buttons/base.button";

export function TitleMenu() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 10,
        right: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        backgroundColor: "#1a1a1a",
        border: "1px solid #444444",
        borderRadius: 4,
        padding: 12,
      }}
    >
      <BaseButton href={import.meta.env.VITE_REGISTER_URL}>Register</BaseButton>
      <BaseButton href={import.meta.env.VITE_RESTORE_PASSWORD_URL}>Restore password</BaseButton>
      <BaseButton href={import.meta.env.VITE_WIKI_URL}>Wiki portal</BaseButton>
      <BaseButton>Settings</BaseButton>
    </div>
  );
}
