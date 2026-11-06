// Gudu’s Tube: single-file Cloudflare Worker (page + YouTube API proxy)
const HTML = "<!DOCTYPE html>\n<html lang=\"hi\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n<meta name=\"mobile-web-app-capable\" content=\"yes\">\n<link rel=\"manifest\" href=\"/manifest.webmanifest\">\n<title>Gudu’s Tube</title>\n<style>\n:root{--bg:#fff;--bg2:#f0f0f0;--ink:#0f0f0f;--mute:#606060;--line:#e2e2e2;--accent:#e0261b}\n@media (prefers-color-scheme:dark){:root{--bg:#0f0f0f;--bg2:#272727;--ink:#f1f1f1;--mute:#a8a8a8;--line:#303030;--accent:#ff4e45}}\n*{box-sizing:border-box}\nbody{margin:0;background:var(--bg);color:var(--ink);font:15px/1.4 system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}\nbutton{font:inherit;cursor:pointer;border:0;border-radius:18px;padding:8px 14px;background:var(--bg2);color:var(--ink)}\nbutton.on{background:var(--ink);color:var(--bg)}\nbutton:focus-visible,input:focus-visible,.vid:focus-visible{outline:2px solid var(--accent);outline-offset:2px}\n.top{position:sticky;top:0;z-index:10;background:var(--bg);display:flex;align-items:center;gap:10px;padding:10px 16px;flex-wrap:wrap;border-bottom:1px solid var(--line)}\n.logo{font-weight:700;font-size:20px;letter-spacing:-.03em}.logo span{color:var(--accent)}\n#f{flex:1;display:flex;min-width:200px;max-width:600px;margin:0 auto}\n#f input{flex:1;min-width:0;padding:9px 14px;border:1px solid var(--line);border-radius:20px 0 0 20px;background:var(--bg);color:var(--ink);font:inherit}\n#f button{border-radius:0 20px 20px 0;border:1px solid var(--line);border-left:0}\nnav{display:flex;gap:6px}\n.chips{display:flex;gap:8px;overflow-x:auto;padding:12px 16px;scrollbar-width:none}\n.chips button{white-space:nowrap}\n.feed{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:28px 16px;padding:8px 16px 24px}\n.feed.shorts{grid-template-columns:repeat(auto-fill,minmax(190px,1fr))}\n.vid{cursor:pointer;min-width:0}\n.thumb{position:relative;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:var(--bg2)}\n.feed.shorts .thumb{aspect-ratio:9/16}\n.thumb img{width:100%;height:100%;object-fit:cover;display:block}\n.dur{position:absolute;right:6px;bottom:6px;background:rgba(0,0,0,.8);color:#fff;font-size:12px;padding:1px 5px;border-radius:4px}\n.meta{display:flex;gap:8px;margin-top:8px}\n.meta h4{margin:0;font-size:15px;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}\n.meta p{margin:2px 0 0;color:var(--mute);font-size:13px}\n.meta>div{flex:1;min-width:0}\n.save{background:transparent;padding:2px 6px;font-size:18px;color:var(--mute);align-self:flex-start}\n.save.on{color:var(--accent);background:transparent}\n.msg{text-align:center;color:var(--mute);padding:24px 16px}\n#watch{padding:16px;max-width:1000px;margin:0 auto}\n.frame{position:relative;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden}\n.frame.short{aspect-ratio:9/16;max-width:360px;margin:0 auto;max-height:78vh}\n.frame>*{position:absolute;inset:0;width:100%;height:100%}\n#watch h2{font-size:19px;margin:12px 0 6px}\n.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:var(--mute)}\n.row span{flex:1}\n#wd{white-space:pre-wrap;color:var(--mute);font-size:14px;max-height:140px;overflow:auto;background:var(--bg2);padding:10px;border-radius:10px}\n[hidden]{display:none!important}\n@media (max-width:640px){.feed{padding:8px 0 24px;gap:22px}.thumb{border-radius:0}.feed .meta{padding:0 12px}.feed.shorts{grid-template-columns:repeat(2,1fr);gap:12px 4px;padding:8px 4px}.feed.shorts .thumb{border-radius:10px}#watch{padding:0 0 12px}.frame{border-radius:0}#watch>:not(.frame){margin-left:12px;margin-right:12px}}\n</style>\n</head>\n<body>\n<header class=\"top\">\n  <div class=\"logo\">Gudu’s <span>Tube</span></div>\n  <form id=\"f\"><input id=\"q\" placeholder=\"Search karo ya YouTube link paste karo\" aria-label=\"Search\"><button>Search</button></form>\n  <nav>\n    <button data-v=\"home\" class=\"on\">Home</button>\n    <button data-v=\"saved\">Saved</button>\n    <button data-v=\"history\">History</button>\n  </nav>\n</header>\n\n<section id=\"watch\" hidden>\n  <div class=\"frame\" id=\"frame\"><div id=\"player\"></div></div>\n  <h2 id=\"wt\"></h2>\n  <div class=\"row\"><span id=\"wc\"></span><button id=\"ws\"></button><button id=\"wx\">Band karo</button></div>\n  <p id=\"wd\"></p>\n</section>\n\n<div class=\"chips\" id=\"chips\"></div>\n<main class=\"feed\" id=\"feed\"></main>\n<div class=\"msg\" id=\"msg\"></div>\n<div id=\"sentinel\" style=\"height:1px\"></div>\n\n<script>\nconst $ = s => document.querySelector(s);\nconst store = {\n  get(k, d){ try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch(e){ return d; } },\n  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }\n};\nlet favs = store.get('gt_favs', []), hist = store.get('gt_hist', []);\nlet view = 'home', chip = 'All', q = '', st = null, cur = [], seen = new Set(), now = null;\nlet yt = null, ready = false, pending = null;\n\nconst CHIPS = [['All'],['Shorts'],['Music','10'],['Gaming','20'],['Comedy','23'],['News','25'],['Sports','17'],['Science & Tech','28'],['Education','27'],['Bollywood songs',null,'bollywood songs'],['Cricket',null,'cricket highlights'],['Cooking',null,'indian recipes']];\n\n/* ---------- helpers ---------- */\nconst decode = s => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };\nfunction dur(iso){\n  const m = (iso || '').match(/PT(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+)S)?/); if (!m) return '';\n  const h = +m[1] || 0, mi = +m[2] || 0, s = +m[3] || 0, p = n => String(n).padStart(2, '0');\n  return h ? h + ':' + p(mi) + ':' + p(s) : mi + ':' + p(s);\n}\nfunction views(n){\n  n = +n; if (!n) return '';\n  if (n >= 1e7) return (n / 1e7).toFixed(1) + ' Cr views';\n  if (n >= 1e5) return (n / 1e5).toFixed(1) + ' L views';\n  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K views';\n  return n + ' views';\n}\nconst isFav = id => favs.some(v => v.id === id);\nfunction mapVideo(i){\n  const t = i.snippet.thumbnails;\n  return {\n    id: i.id, title: decode(i.snippet.title), channel: decode(i.snippet.channelTitle),\n    thumb: (t.high || t.medium || t.default).url,\n    desc: (i.snippet.description || '').slice(0, 400),\n    views: i.statistics && i.statistics.viewCount,\n    duration: i.contentDetails && dur(i.contentDetails.duration),\n    isShort: !!i.isShort\n  };\n}\nasync function api(endpoint, params){\n  const r = await fetch('/api/yt?' + new URLSearchParams({ endpoint, ...params }));\n  const d = await r.json();\n  if (d.error) throw new Error(d.error.message || 'API error');\n  return d;\n}\n\n/* ---------- data ---------- */\nasync function fetchPage(s){\n  const part = 'snippet,contentDetails,statistics';\n  if (s.kind === 'trend'){\n    const p = { part, chart: 'mostPopular', regionCode: 'IN', maxResults: 24 };\n    if (s.cat) p.videoCategoryId = s.cat;\n    if (s.token) p.pageToken = s.token;\n    const d = await api('videos', p);\n    s.token = d.nextPageToken || ''; if (!s.token) s.done = true;\n    return d.items.map(mapVideo);\n  }\n  const p = { part: 'snippet', type: 'video', maxResults: 30, q: s.q, regionCode: 'IN' };\n  if (s.short) p.videoDuration = 'short';\n  if (s.token) p.pageToken = s.token;\n  const d = await api('search', p);\n  s.token = d.nextPageToken || ''; if (!s.token) s.done = true;\n  const ids = d.items.map(i => i.id && i.id.videoId).filter(Boolean);\n  if (!ids.length) return [];\n  const v = await api('videos', { part, id: ids.join(',') });\n  return v.items.map(mapVideo);\n}\n\nasync function loadMore(){\n  if (!st || st.busy || st.done) return;\n  const my = st; my.busy = true;\n  $('#msg').textContent = 'Load ho raha hai…';\n  try {\n    let added = [], tries = 0;\n    while (!added.length && !my.done && tries++ < 4){\n      const items = await fetchPage(my);\n      if (my !== st) return;\n      added = items.filter(v => !seen.has(v.id) && (my.filter === 'all' || (my.filter === 'shorts') === v.isShort));\n    }\n    added.forEach(v => { seen.add(v.id); cur.push(v); $('#feed').appendChild(card(v)); });\n    $('#msg').textContent = cur.length ? '' : 'Kuch nahi mila.';\n  } catch(e){\n    if (my === st) $('#msg').textContent = 'Error: ' + e.message;\n  } finally { my.busy = false; }\n}\nnew IntersectionObserver(es => { if (es[0].isIntersecting) loadMore(); }, { rootMargin: '600px' }).observe($('#sentinel'));\n\n/* ---------- UI ---------- */\nfunction card(v){\n  const c = document.createElement('div'); c.className = 'vid'; c.tabIndex = 0;\n  const th = document.createElement('div'); th.className = 'thumb';\n  const img = document.createElement('img'); img.src = v.thumb; img.alt = ''; img.loading = 'lazy'; th.appendChild(img);\n  if (v.duration){ const d = document.createElement('span'); d.className = 'dur'; d.textContent = v.duration; th.appendChild(d); }\n  const meta = document.createElement('div'); meta.className = 'meta';\n  const box = document.createElement('div');\n  const h = document.createElement('h4'); h.textContent = v.title;\n  const p = document.createElement('p'); p.textContent = [v.channel, views(v.views)].filter(Boolean).join(' • ');\n  box.append(h, p);\n  const sv = document.createElement('button'); sv.className = 'save' + (isFav(v.id) ? ' on' : '');\n  sv.textContent = isFav(v.id) ? '★' : '☆'; sv.setAttribute('aria-label', 'Save');\n  sv.onclick = e => { e.stopPropagation(); toggleFav(v); sv.className = 'save' + (isFav(v.id) ? ' on' : ''); sv.textContent = isFav(v.id) ? '★' : '☆'; };\n  meta.append(box, sv); c.append(th, meta);\n  c.onclick = () => play(v);\n  c.onkeydown = e => { if (e.key === 'Enter') play(v); };\n  return c;\n}\nfunction toggleFav(v){\n  favs = isFav(v.id) ? favs.filter(x => x.id !== v.id) : [v, ...favs];\n  store.set('gt_favs', favs); updateSave();\n  if (view === 'saved') start();\n}\nfunction updateSave(){ if (now) $('#ws').textContent = isFav(now.id) ? '★ Saved' : '☆ Save'; }\n\nfunction renderChips(){\n  const box = $('#chips'); box.textContent = '';\n  CHIPS.forEach(([name]) => {\n    const b = document.createElement('button'); b.textContent = name; if (name === chip) b.className = 'on';\n    b.onclick = () => { chip = name; q = ''; $('#q').value = ''; renderChips(); start(); };\n    box.appendChild(b);\n  });\n}\n\nfunction start(){\n  $('#chips').hidden = !(view === 'home' && !q);\n  $('#feed').textContent = ''; $('#msg').textContent = ''; seen = new Set(); cur = []; st = null;\n  $('#feed').classList.remove('shorts');\n  if (view === 'saved' || view === 'history'){\n    cur = view === 'saved' ? favs : hist;\n    cur.forEach(v => $('#feed').appendChild(card(v)));\n    $('#msg').textContent = cur.length ? '' : (view === 'saved' ? 'Koi saved video nahi. Kisi video par ☆ dabao.' : 'History khaali hai.');\n    return;\n  }\n  const c = CHIPS.find(x => x[0] === chip) || CHIPS[0];\n  if (q) st = { kind: 'search', q, filter: 'all' };\n  else if (chip === 'Shorts') st = { kind: 'search', q: '#shorts', short: true, filter: 'shorts' };\n  else if (c[2]) st = { kind: 'search', q: c[2], filter: 'normal' };\n  else st = { kind: 'trend', cat: c[1] || '', filter: 'normal' };\n  $('#feed').classList.toggle('shorts', st.filter === 'shorts');\n  loadMore();\n}\n\n/* ---------- player (official YouTube IFrame API) ---------- */\nconst sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(sc);\nwindow.onYouTubeIframeAPIReady = () => {\n  yt = new YT.Player('player', {\n    width: '100%', height: '100%', playerVars: { playsinline: 1, rel: 0 },\n    events: {\n      onReady: () => { ready = true; if (pending){ yt.loadVideoById(pending); pending = null; } },\n      onStateChange: e => { if (e.data === 0) next(); }\n    }\n  });\n};\nfunction play(v){\n  now = v;\n  hist = [v, ...hist.filter(x => x.id !== v.id)].slice(0, 50); store.set('gt_hist', hist);\n  $('#watch').hidden = false;\n  $('#frame').classList.toggle('short', !!v.isShort);\n  $('#wt').textContent = v.title;\n  $('#wc').textContent = [v.channel, views(v.views)].filter(Boolean).join(' • ');\n  $('#wd').textContent = v.desc || ''; $('#wd').hidden = !v.desc;\n  updateSave();\n  if (ready) yt.loadVideoById(v.id); else pending = v.id;\n  window.scrollTo({ top: 0, behavior: 'smooth' });\n}\nfunction next(){\n  if (!cur.length) return;\n  const i = cur.findIndex(v => v.id === (now && now.id));\n  if (i >= 0 && i < cur.length - 1) play(cur[i + 1]);\n}\n$('#ws').onclick = () => now && toggleFav(now);\n$('#wx').onclick = () => { $('#watch').hidden = true; if (ready) yt.stopVideo(); };\n\n/* ---------- events ---------- */\ndocument.querySelectorAll('nav button').forEach(b => b.onclick = () => {\n  view = b.dataset.v;\n  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b));\n  q = ''; $('#q').value = ''; start();\n});\n$('#f').addEventListener('submit', e => {\n  e.preventDefault();\n  const t = $('#q').value.trim(); if (!t) return;\n  const m = t.match(/(?:v=|youtu\\.be\\/|shorts\\/|embed\\/)([\\w-]{11})/) || t.match(/^([\\w-]{11})$/);\n  if (m) return play({ id: m[1], title: 'YouTube video', channel: '', thumb: 'https://i.ytimg.com/vi/' + m[1] + '/hqdefault.jpg', desc: '', isShort: /shorts\\//.test(t) });\n  view = 'home'; q = t;\n  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x.dataset.v === 'home'));\n  start();\n});\n\nrenderChips(); start();\n</script>\n</body>\n</html>\n";
const MANIFEST = "{\n  \"name\": \"Gudu’s Tube\",\n  \"short_name\": \"Gudu’s Tube\",\n  \"start_url\": \"/\",\n  \"display\": \"standalone\",\n  \"background_color\": \"#000000\",\n  \"theme_color\": \"#000000\"\n}\n";

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
    if (url.pathname !== "/api/yt") {
      const p = url.pathname;
      if (p === "/manifest.webmanifest") return new Response(MANIFEST, { headers: { "content-type": "application/manifest+json" } });
      return new Response(HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

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
