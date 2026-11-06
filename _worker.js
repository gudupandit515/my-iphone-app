// Cloudflare Pages worker: /api/yt proxies the YouTube Data API so the key stays on the server.
// Everything else is served from the static files.
const ALLOWED = new Set(["search", "videos"]);

const secs = (iso = "") => {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
};

const known = new Map(); // warm-instance cache: id -> isShort

// /shorts/<id> answers 200 for a Short and redirects to /watch for a normal video
async function checkShort(id, fallback) {
  if (known.has(id)) return known.get(id);
  try {
    const r = await fetch("https://www.youtube.com/shorts/" + id, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(3500),
    });
    if (r.status === 200 || (r.status >= 300 && r.status < 400)) {
      const v = r.status === 200;
      if (known.size > 20000) known.clear();
      known.set(id, v);
      return v;
    }
  } catch (e) {}
  return fallback;
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/yt") return env.ASSETS.fetch(request);

    if (!env.YT_KEY) return json({ error: { message: "Server par YT_KEY secret set nahi hai" } }, 500);
    const endpoint = url.searchParams.get("endpoint") || "";
    if (!ALLOWED.has(endpoint)) return json({ error: { message: "Endpoint allowed nahi hai" } }, 400);

    const target = new URL("https://www.googleapis.com/youtube/v3/" + endpoint);
    for (const [k, v] of url.searchParams) {
      if (k !== "endpoint" && k !== "key") target.searchParams.set(k, v);
    }
    target.searchParams.set("key", env.YT_KEY);

    const r = await fetch(target);
    let body = await r.text();

    if (endpoint === "videos" && r.ok) {
      try {
        const d = JSON.parse(body);
        if (Array.isArray(d.items)) {
          let budget = 40; // Workers allow ~50 subrequests per request
          await Promise.all(
            d.items.map(async (it) => {
              const s = secs(it.contentDetails && it.contentDetails.duration);
              const text = ((it.snippet && it.snippet.title) || "") + " " + ((it.snippet && it.snippet.description) || "") + " " + ((it.snippet && it.snippet.tags) || []).join(" ");
              const tagged = /#shorts?\b/i.test(text);
              const guess = tagged || (s > 0 && s <= 60);
              if (!s || s > 180) it.isShort = false;
              else if (budget-- > 0) it.isShort = await checkShort(it.id, guess);
              else it.isShort = guess;
            })
          );
          body = JSON.stringify(d);
        }
      } catch (e) {}
    }

    return new Response(body, {
      status: r.status,
      headers: {
        "content-type": "application/json",
        "cache-control": r.ok ? "public, max-age=300" : "no-store",
      },
    });
  },
};
