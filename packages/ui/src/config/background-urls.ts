// Base URLs are provided via env, e.g.
// "http://localhost:4000/legacy/images/titlescreens/{id}.jpg". "{id}" gets
// replaced with a random 1..N, where N comes from the server's sibling
// "count" endpoint (e.g. GET .../legacy/images/titlescreens/count ->
// { count: number }), not a build-time env var -- so new files dropped on
// the server show up without rebuilding the UI.
const LOGIN_BACKGROUND_IMAGE_BASE_URL = import.meta.env.VITE_LOGIN_BACKGROUND_IMAGE_BASE_URL;
const LOGIN_BACKGROUND_VIDEO_BASE_URL = import.meta.env.VITE_LOGIN_BACKGROUND_VIDEO_BASE_URL;

function countUrlFor(baseUrl: string | undefined): string | undefined {
  if (!baseUrl) {
    return undefined;
  }
  return baseUrl.replace(/\{id\}\.[^/]+$/, "count");
}

async function fetchBackgroundCount(baseUrl: string | undefined): Promise<number> {
  const countUrl = countUrlFor(baseUrl);
  if (!countUrl) {
    return 0;
  }

  try {
    const response = await fetch(countUrl);
    if (!response.ok) {
      return 0;
    }
    const data: unknown = await response.json();
    const count = (data as { count?: unknown })?.count;
    return typeof count === "number" && count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

async function getRandomAssetUrl(baseUrl: string | undefined): Promise<string | undefined> {
  if (!baseUrl) {
    return undefined;
  }
  const count = await fetchBackgroundCount(baseUrl);
  if (count <= 0) {
    return undefined;
  }
  const id = 1 + Math.floor(Math.random() * count);
  return baseUrl.replace("{id}", String(id));
}

/** Random login background image URL served by the assets server, or undefined if unavailable. */
export function getRandomLoginBackgroundImageUrl(): Promise<string | undefined> {
  return getRandomAssetUrl(LOGIN_BACKGROUND_IMAGE_BASE_URL);
}

/** Random login background video URL served by the assets server, or undefined if unavailable. */
export function getRandomLoginBackgroundVideoUrl(): Promise<string | undefined> {
  return getRandomAssetUrl(LOGIN_BACKGROUND_VIDEO_BASE_URL);
}
