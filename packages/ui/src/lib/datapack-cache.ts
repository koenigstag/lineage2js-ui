import { datapackUrl } from "../config/datapack-urls";

/**
 * Cache-Storage layer for the datapack tables (item names, item stats, npc
 * names, ...) -- roughly 5MB of static reference JSON that every session
 * fetches from the assets server.
 *
 * The server's own caching isn't enough on its own. It serves these like every
 * other asset, with an hour of `max-age` and an ETag, under names that don't
 * change when a table is re-converted -- so a client either holds a stale
 * table for up to an hour, or revalidates all twenty-four of them on every
 * reload once that hour is up.
 *
 * So the server stamps each table with a token from its size and mtime (see
 * assets-server's `/highfive/datapack/versions.json`) and this fetches through
 * Cache Storage keyed by `<url>?v=<token>`. A table that hasn't changed keeps
 * its key, stays in the cache across deploys, and costs no network at all --
 * the only request a warm session makes is the manifest itself. A table that
 * did change gets a new key, misses, and is fetched once.
 *
 * The manifest is uncacheable by the server, which is what makes the scheme
 * safe: it is the one request that always reflects what is actually on disk.
 *
 * Degrades to a plain fetch, with no caching and no versioned URL, whenever
 * any part of this isn't available: an insecure context (`caches` is
 * secure-context only, so plain http on a LAN address has none), or a manifest
 * that failed to load. With no assets server configured at all it throws, and
 * every caller in DatapackStore already treats that as "leave this table empty
 * and fall back to the raw id".
 */

const CACHE_NAME = "datapack";
const MANIFEST_PATH = "versions.json";

/** table path (e.g. "item-names/en.json") -> size+mtime token. */
type DatapackVersions = Record<string, string>;

let manifestPromise: Promise<DatapackVersions | null> | undefined;

function cacheStorage(): CacheStorage | undefined {
  // Secure contexts only -- undefined over plain http, and absent in
  // non-browser environments (the headless checks in scripts/).
  return typeof caches !== "undefined" ? caches : undefined;
}

async function loadManifest(): Promise<DatapackVersions | null> {
  const url = datapackUrl(MANIFEST_PATH);
  if (!url) {
    return null;
  }
  try {
    const response = await fetch(url);
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
    // Absolute URLs on both sides: the tables live on the assets server's
    // origin now, so a pathname comparison would drop the half that
    // distinguishes them from anything else cached under the same path.
    const current = new Set(
      Object.entries(versions)
        .map(([path, version]) => versionedUrl(path, version))
        .filter((url): url is string => Boolean(url))
        .map((url) => new URL(url).href)
    );
    for (const request of await cache.keys()) {
      if (!current.has(new URL(request.url).href)) {
        await cache.delete(request);
      }
    }
  } catch {
    // Storage full, evicted mid-iteration, private mode -- nothing to do.
  }
}

function versionedUrl(path: string, version: string): string | undefined {
  const url = datapackUrl(path);
  return url && `${url}?v=${version}`;
}

/**
 * Fetches one datapack table by its path (e.g. "item-names/en.json"), through
 * the cache when there's a version to key it by. Returns a Response so callers
 * keep their existing `await response.json()` shape, and throws when there is
 * no assets server to ask.
 */
export async function fetchDatapack(path: string): Promise<Response> {
  const plainUrl = datapackUrl(path);
  if (!plainUrl) {
    throw new Error(`No assets server configured for datapack "${path}" (VITE_DATAPACK_BASE_URL)`);
  }

  manifestPromise ??= loadManifest();
  const versions = await manifestPromise;
  const version = versions?.[path];

  const url = (version && versionedUrl(path, version)) || plainUrl;

  // Only a versioned URL is worth caching. An unversioned one -- no manifest,
  // or a table missing from it -- has nothing to invalidate it, so caching it
  // would pin whatever it happened to fetch.
  const cache = version ? await openCache() : undefined;
  if (cache) {
    try {
      const cached = await cache.match(url);
      if (cached) {
        return cached;
      }
    } catch {
      // Evicted mid-lookup, storage disabled -- fall through to the network.
    }
  }

  const response = checked(await fetch(url), path);
  if (cache) {
    // Clone before storing: a Response body can only be read once, and the
    // caller is about to read it. Fire-and-forget, since a cache that refuses
    // the write costs a re-fetch next time, not correctness now.
    void cache.put(url, response.clone()).catch(() => {});
  }
  return response;
}

/** The datapack cache, or undefined wherever there isn't one to open. */
async function openCache(): Promise<Cache | undefined> {
  const storage = cacheStorage();
  if (!storage) {
    return undefined;
  }
  try {
    return await storage.open(CACHE_NAME);
  } catch {
    // Quota exhausted, private mode -- the network path still works.
    return undefined;
  }
}

/**
 * Turns a 404 into a throw rather than letting the caller's `response.json()`
 * choke on an error page. Worth being explicit about now that these tables are
 * fetched from a separate server that may simply not have them.
 */
function checked(response: Response, path: string): Response {
  if (!response.ok) {
    throw new Error(`Datapack "${path}": ${response.status}`);
  }
  return response;
}
