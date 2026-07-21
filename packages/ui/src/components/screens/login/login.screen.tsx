import { useEffect, useRef, useState } from "react";
import { Screen } from "../../core/screen.component";
import { LegalFooter } from "../../core/legal-footer.component";
import { TitleMenu } from "../../menus/title/title.menu";
import { LoginMenu, type LoginMenuHandle } from "../../menus/login/login.menu";
import { AccountsMenu } from "../../menus/known-accounts/accounts.menu";
import { WindowsRoot } from "../../windows/core/windows-root";
import { LOGIN_WINDOW_IDS } from "../../../config/windows.registry";
import { getRandomLoginBackground } from "../../../assets/login/backgrounds";
import {
  getRandomLoginBackgroundImageUrl,
  getRandomLoginBackgroundVideoUrl,
} from "../../../config/background-urls";
import { AtmosphereScene } from "./atmosphere/atmosphere-scene.component";

interface LoginBackground {
  type: "image" | "video";
  url: string;
}

export function LoginScreen() {
  // undefined = still resolving (don't show the sky gradient yet, to avoid a
  // flash before a real background loads); null = resolved, nothing found.
  const [background, setBackground] = useState<LoginBackground | null | undefined>(undefined);
  const loginMenuRef = useRef<LoginMenuHandle>(null);

  useEffect(() => {
    const localImage = getRandomLoginBackground();
    if (localImage) {
      setBackground({ type: "image", url: localImage });
      return;
    }

    let cancelled = false;

    (async () => {
      const videoUrl = await getRandomLoginBackgroundVideoUrl();
      if (cancelled) return;
      if (videoUrl) {
        setBackground({ type: "video", url: videoUrl });
        return;
      }

      const imageUrl = await getRandomLoginBackgroundImageUrl();
      if (!cancelled) {
        setBackground(imageUrl ? { type: "image", url: imageUrl } : null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Screen
      className="screen screen--login"
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundImage: background?.type === "image" ? `url(${background.url})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        {background?.type === "video" && (
          <video
            key={background.url}
            autoPlay
            loop
            muted
            playsInline
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          >
            <source src={background.url} />
          </video>
        )}
        {background === null && <AtmosphereScene />}
        <WindowsRoot ids={LOGIN_WINDOW_IDS} />

        <LoginMenu ref={loginMenuRef} />
        <TitleMenu />
        <AccountsMenu onSelectAccount={(login) => loginMenuRef.current?.fillAccount(login)} />
      </div>
      <LegalFooter />
    </Screen>
  );
}
