# Deploying

The client is a static bundle served from your own host rather than GitHub
Pages, alongside the assets server. Screens live in the URL hash (see
`src/App.tsx`), so there is no server-side routing to arrange: any static host
will do.

Nothing here names a real host or domain, on purpose. `example.com` and
`myhost` below are placeholders — the first is the domain you serve from, the
second whatever you call the box in `~/.ssh/config`. The real values live in
your ssh config, your DNS and the gitignored `packages/ui/.env.production`,
and are deliberately kept out of this repository.

| What             | Where                                          |
| ---------------- | ---------------------------------------------- |
| Web client       | `https://example.com:4443/`                    |
| Assets server    | `https://example.com:4000/highfive/...`        |
| Checkout         | `~/lineage2/lineage2js-ui`                     |
| Served directory | `/srv/l2client/dist`                           |

**The port is a choice, not a requirement.** Serving on 4443 rather than 443
lets the client share a host whose 443 already belongs to another site,
without a new subdomain, DNS record or certificate — the same trick the
assets-server vhost plays on 4000. If 443 is free, use it and drop the port
from the URLs. Nothing in the bundle knows its own host or port, so switching
later is a change to `nginx/l2-client.conf` and DNS, with no rebuild.

## Routine deploy

```bash
ssh myhost '~/lineage2/lineage2js-ui/deploy/deploy-ui.sh'
```

That pulls `main`, installs, builds and rsyncs into the served directory. It
never touches nginx — the vhost only points at a directory, so a deploy is
just new files in it.

If the pull fails with *"untracked working tree files would be overwritten"*,
it is a `.gitkeep` that a new commit started tracking while an untracked copy
already existed on the box. Delete that one file — not the folder, the real
assets live in it and are gitignored — and run the script again.

## First-time setup

1. **`packages/ui/.env.production`** in the checkout, gitignored, holding
   every `VITE_*` the client reads. These are baked into the bundle at build
   time, so the machine that builds is the one that needs them; none of it is
   secret (it all ends up in the public JS), but it is deploy config rather
   than source, and it is where your real domain belongs. Start from
   `packages/ui/.env.example`.

   `VITE_DATAPACK_BASE_URL` is the one to get right: unset, the client still
   runs but every name in it degrades to a raw id.

2. **The served directory**, somewhere nginx can actually reach. `$HOME` is
   commonly `drwxr-x---`, which www-data cannot traverse, so serving straight
   out of the checkout will 403:

   ```bash
   mkdir -p /srv/l2client/dist
   ```

3. **The nginx vhost**, from `nginx/l2-client.conf` in this directory. It is a
   template: replace `example.com` in all three places with your own domain
   first, then install it.

   ```bash
   sudo cp ~/lineage2/lineage2js-ui/deploy/nginx/l2-client.conf /etc/nginx/sites-available/l2-client
   sudo ln -sf /etc/nginx/sites-available/l2-client /etc/nginx/sites-enabled/l2-client
   sudo nginx -t && sudo systemctl reload nginx
   ```

   Always `nginx -t` before reloading: a broken vhost takes down every other
   site on the box with it.

4. **The port**, if the host filters inbound traffic at all — `ufw allow
   4443/tcp`, plus whatever cloud firewall sits in front of it. A host with
   neither needs nothing here, and a port is reachable as soon as nginx binds
   it.

## Verifying

```bash
curl -sI https://example.com:4443/ | head -5
```

Expect `200` and `cache-control: no-cache` on the entry point, and
`immutable` on anything under `/assets/`. That is nearly all this vhost
serves: the bundle and its entry point, and little else.

Everything the client then reads comes from the assets server on its own
origin, port 4000 — icons, bodies, and the reference tables that turn ids into
words. Those are cross-origin fetches, and they work because the assets server
sends `Access-Control-Allow-Origin: *`. So if the page loads but shows raw ids
(`item.name.57` instead of a name) or no art, the fault is on that origin or
in the `VITE_*` values the bundle was built with, not in this vhost:

```bash
curl -sI https://example.com:4000/highfive/datapack/versions.json | head -3
```

That manifest is what the client's cache keys every table by, and the assets
server serves it `no-store` deliberately — caching it would defeat the
mechanism it drives (see the UI's `src/lib/datapack-cache.ts`).
