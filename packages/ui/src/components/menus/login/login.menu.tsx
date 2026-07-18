import { useState } from "react";
import { observer } from "mobx-react-lite";
import { BaseInput } from "../../core/inputs/base.input";
import { BaseButton } from "../../core/buttons/base.button";
import { useStore } from "../../../stores/StoreContext";

export const LoginMenu = observer(function LoginMenu() {
  const store = useStore();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin() {
    await new Promise((resolve) => setTimeout(resolve, 300));
    store.setScreen("game");
  }

  function handleExit() {
    window.close();
  }

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: 240,
        backgroundColor: "#1a1a1a",
        border: "1px solid #444444",
        borderRadius: 4,
        padding: 16,
      }}
    >
      <BaseInput value={account} placeholder="Account" onChange={setAccount} />
      <BaseInput value={password} placeholder="Password" onChange={setPassword} type="password" />
      <div style={{ display: "flex", gap: 8 }}>
        <BaseButton onClick={handleLogin}>Login</BaseButton>
        <BaseButton onClick={handleExit}>Exit</BaseButton>
      </div>
    </div>
  );
});
