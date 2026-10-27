import { useEffect, useState } from "react";
import { getWorldEnvUrl } from "../../config/world-assets";
import type { WorldEnv } from "./map-scene.types";

/**
 * The world's lighting curves, fetched once for the whole session.
 *
 * Unlike a map scene there is exactly one of these, it is a few kilobytes, and
 * every map wants it, so it is cached at module scope rather than per
 * component -- a second mount reuses the same promise instead of asking again.
 */
let pending: Promise<WorldEnv | null> | null = null;

function load(): Promise<WorldEnv | null> {
  if (pending) return pending;

  const url = getWorldEnvUrl();
  if (!url) return (pending = Promise.resolve(null));

  pending = fetch(url)
    .then((res) => (res.ok ? (res.json() as Promise<WorldEnv>) : Promise.reject(new Error(`${res.status} ${url}`))))
    .catch((error: unknown) => {
      // The world renders unlit without it, which is the honest failure: see
      // resolveLighting's UNLIT.
      console.warn("[world] no lighting curves; the world will be dark", error);
      return null;
    });

  return pending;
}

export function useWorldEnv(): WorldEnv | null {
  const [env, setEnv] = useState<WorldEnv | null>(null);

  useEffect(() => {
    let cancelled = false;
    void load().then((loaded) => {
      if (!cancelled) setEnv(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return env;
}
