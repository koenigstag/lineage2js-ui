/**
 * Cache-Storage layer for the public/ datapack tables (item names, item
 * stats, npc names, ...) -- roughly 2.8MB of static reference JSON that
 * every session fetches.
 *
 * The hosting cache alone doesn't do a good job of it. GitHub Pages serves
 * these with `Cache-Control: max-age=600` and an ETag of the shape
 * `hex(mtime)-hex(size)` -- so after ten minutes every reload revalidates all
 * thirteen tables, and, worse, the deploy workflow rewrites the whole dist/
 * on any push touching the UI, which changes every mtime and therefore every
 * ETag. A one-line change to an unrelated window makes every client
 * re-download all 2.8MB of data that didn't change.
 *
 * So the build stamps each table with a hash of its contents (see
 * vite.config.ts's datapackVersionsPlugin, which emits
 * datapacks/versions.json) and this fetches through Cache Storage keyed by
 * `<path>?v=<hash>`. A table that hasn't changed keeps its key, stays in the
 * cache across deploys, and costs no network at all -- the only request a
 * warm session makes is the manifest itself. A table that did change gets a
 * new key, misses, and is fetched once.
 *
 * The manifest is left on the host's own ten-minute cache deliberately: a
 * fresh deploy taking up to ten minutes to be noticed is fine for reference
 * data, and busting it would mean an uncacheable request on every load.
 *
 * Degrades to a plain fetch, with no caching and no versioned URL, whenever
 * any part of this isn't available: the dev server (no manifest -- editing a
 * table should show up on reload, not be pinned by a cache), an insecure
 * context (`caches` is secure-context only, so plain http on a LAN address
 * has none), or a manifest that failed to load.
 */

const CACHE_NAME = "datapack";
const MANIFEST_PATH = "datapacks/versions.json";

/** path (as in public/, e.g. "item-names/en.json") -> content hash. */
type DatapackVersions = Record<string, string>;

let manifestPromise: Promise<DatapackVersions | null> | undefined;

function cacheStorage(): CacheStorage | undefined {
  // Secure contexts only -- undefined over plain http, and absent in
  // non-browser environments (the headless checks in scripts/).
  return typeof caches !== "undefined" ? caches : undefined;
}

async function loadManifest(): Promise<DatapackVersions | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}${MANIFEST_PATH}`);
    if (!response.ok) {
      return null;
    }
    const versions: DatapackVersions = await response.json();
    void pruneStaleEntries(versions);
    return versions;
  } catch {
    return null;
  }
}

/**
 * Drops cached tables whose version is no longer current. Without this the
 * cache keeps a copy of every version of every table ever deployed, growing
 * without bound. Fire-and-forget -- a failure here costs disk, not
 * correctness.
 */
async function pruneStaleEntries(versions: DatapackVersions): Promise<void> {
  const storage = cacheStorage();
  if (!storage) {
    return;
  }
  try {
    const cache = await storage.open(CACHE_NAME);
    const current = new Set(Object.entries(versions).map(([path, version]) => versionedUrl(path, version)));
    for (const request of await cache.keys()) {
      if (!current.has(new URL(request.url).pathname + new URL(request.url).search)) {
        await cache.delete(request);
      }
    }
  } catch {
    // Storage full, evicted mid-iteration, private mode -- nothing to do.
  }
}

function versionedUrl(path: string, version: string): string {
  return `${import.meta.env.BASE_URL}${path}?v=${version}`;
}

/**
 * Fetches one datapack table by its public/ path, through the cache when
 * there's a version to key it by. Returns a Response so callers keep their
 * existing `await response.json()` shape.
 */
export async function fetchDatapack(path: string): Promise<Response> {
  manifestPromise ??= loadManifest();
  const versions = await manifestPromise;
  const version = versions?.[path];

  if (!version) {
    return fetch(`${import.meta.env.BASE_URL}${path}`);
  }

  const url = versionedUrl(path, version);
  const storage = cacheStorage();
  if (!storage) {
    return fetch(url);
  }

  try {
    const cache = await storage.open(CACHE_NAME);
    const cached = await cache.match(url);
    if (cached) {
      return cached;
    }

    const response = await fetch(url);
    if (response.ok) {
      // Clone before returning: a Response body can only be read once, and
      // the caller is about to read it.
      await cache.put(url, response.clone());
    }
    return response;
  } catch {
    // Cache unavailable (quota, private mode) -- the network still works.
    return fetch(url);
  }
}
