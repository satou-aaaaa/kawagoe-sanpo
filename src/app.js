// 川越さんぽの動き。外へは何も送らない（現在地もこの端末の中だけで使う）。
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const codes = LANGS.map((l) => l[0]);
  const guess = () => { const n = (navigator.language || "ja").toLowerCase(); return n.startsWith("ja") ? "ja" : n.startsWith("zh") ? "zh" : n.startsWith("ko") ? "ko" : "en"; };
  const urlLang = new URLSearchParams(location.search).get("lang");
  const now = new Date();
  const H0 = 8, H1 = 21; // 画面で選べる時間（8時〜21時）
  const st = {
    lang: codes.includes(urlLang) ? urlLang : codes.includes(LS("ks-lang")) ? LS("ks-lang") : guess(),
    tab: "now",
    hol: now.getDay() === 0 || now.getDay() === 6, // 土日。祝日は自分で切り替える
    hour: Math.min(H1, Math.max(H0, now.getHours())),
    from: STARTS[1], // { lat, lon, name } か現在地
    gpsMsg: "",
    spot: "ichibangai",
  };
  const t = (k) => (T[st.lang] && T[st.lang][k] !== undefined ? T[st.lang][k] : T.ja[k]);
  const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => o[k]);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nm = (x) => x.name[st.lang] || x.name.en;
  const byId = (id) => SPOTS.find((s) => s.id === id);

  // 距離（m）と方角（度。北=0、時計回り）
  function geo(a, b) {
    const R = 6371000, r = Math.PI / 180;
    const p1 = a.lat * r, p2 = b.lat * r, dp = (b.lat - a.lat) * r, dl = (b.lon - a.lon) * r;
    const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    const d = 2 * R * Math.asin(Math.sqrt(h));
    const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return { d, b: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360 };
  }
  const DIRS = ["dirN", "dirNE", "dirE", "dirSE", "dirS", "dirSW", "dirW", "dirNW"];
  const dirName = (b) => t(DIRS[Math.round(b / 45) % 8]);
  const dist = (m) => (m < 1000 ? Math.round(m / 10) * 10 + t("meters") : (m / 1000).toFixed(1) + t("km"));
  const walkMin = (m) => Math.max(1, Math.round((m * 1.3) / 80)); // 直線の1.3倍を分速80mで歩く（不動産の表示の決まりと同じ分速）

  // 混み具合の目安（0〜4）。一番街のまわり（core）の休日の形を元に、平日は1段下げ、mid は2段・quiet は3段下げる。
  // 測ったものではない（画面の「このアプリ」に書く）。本番はお店のボタンや人の流れのデータで置き換える
  const CORE = { 8: 0, 9: 0, 10: 2, 11: 3, 12: 4, 13: 4, 14: 4, 15: 3, 16: 2, 17: 1, 18: 0, 19: 0, 20: 0, 21: 0 };
  const DROP = { core: 0, mid: 2, quiet: 3 };
  function level(s, h, hol) {
    const base = CORE[h] === undefined ? 0 : CORE[h];
    return Math.max(0, base - DROP[s.kind] - (hol ? 0 : 1));
  }
  const isOpen = (s, h) => !s.day || (h >= 9 && h < 17);
  function bestHour(s, hol) {
    let best = null;
    for (let h = 9; h <= 20; h++) if (isOpen(s, h) && (best === null || level(s, h, hol) < level(s, best, hol))) best = h;
    return best;
  }
  function suggest(from, h, hol, n) {
    return SPOTS.filter((s) => isOpen(s, h) && level(s, h, hol) <= 1)
      .map((s) => Object.assign({ s, lv: level(s, h, hol) }, geo(from, s)))
      .sort((a, b) => a.lv - b.lv || a.d - b.d).slice(0, n);
  }
  function courseLen(c) {
    let d = 0;
    for (let i = 1; i < c.stops.length; i++) d += geo(byId(c.stops[i - 1]), byId(c.stops[i])).d;
    return d;
  }
  window.KS = { geo, level, bestHour, suggest, courseLen, walkMin }; // 検査用

  const lvTag = (lv) => `<span class="lv lv${lv}">${esc(t("lv")[lv])}</span>`;
  const hourOf = (h) => fmt(t("hourOf"), { h });

  // 地図：場所を緯度・経度でそのまま置く（地図の絵は使わない。外から取らないため）
  function map(h, hol, picks) {
    picks = picks || [];
    // 枠は近くの場所だけで決める。遠い場所（far：伊佐沼・川越駅）と現在地は枠の端に寄せ、矢印を付ける
    const pts = SPOTS.concat(STARTS).filter((p) => !p.far);
    const la = pts.map((p) => p.lat), lo = pts.map((p) => p.lon);
    const minLa = Math.min(...la), maxLa = Math.max(...la), minLo = Math.min(...lo), maxLo = Math.max(...lo);
    const pad = 18, Hh = 360, k = Math.cos((35.92 * Math.PI) / 180);
    const sc = (Hh - 2 * pad) / (maxLa - minLa), W = Math.round(2 * pad + (maxLo - minLo) * k * sc) + 70;
    const x0 = pad + 50; // 左に「一番街」の字を置く余白
    const rx = (p) => x0 + (p.lon - minLo) * k * sc, ry = (p) => Hh - pad - (p.lat - minLa) * sc;
    const cl = (v, a, b) => Math.min(b, Math.max(a, v));
    const X = (p) => cl(rx(p), pad, W - pad).toFixed(1), Y = (p) => cl(ry(p), pad, Hh - pad).toFixed(1);
    const arrowOf = (p) => (rx(p) > W - pad ? " →" : rx(p) < pad ? " ←" : "") + (ry(p) > Hh - pad ? " ↓" : ry(p) < pad ? " ↑" : "");
    // 先にほかの場所、上にすすめた場所（番号つき）を描く
    const order = SPOTS.slice().sort((a, b) => picks.indexOf(a.id) - picks.indexOf(b.id));
    const dots = order.map((s) => {
      const lv = isOpen(s, h) ? level(s, h, hol) : -1, i = picks.indexOf(s.id);
      const c = `<circle class="m lv${lv < 0 ? "x" : lv}${i >= 0 ? " pick" : ""}" cx="${X(s)}" cy="${Y(s)}" r="${i >= 0 ? 10 : 7}"><title>${esc(nm(s))}</title></circle>`;
      return c + (i >= 0 ? `<text class="pn" x="${X(s)}" y="${(+Y(s) + 4).toFixed(1)}">${i + 1}</text>` : "");
    }).join("");
    const core = byId("ichibangai");
    const far = SPOTS.filter((p) => p.far).map((p) => `<text class="lab" text-anchor="end" x="${(+X(p) - 12).toFixed(1)}" y="${(+Y(p) - 14).toFixed(1)}">${esc(nm(p))}${arrowOf(p)}</text>`).join("");
    const lab = `<text class="lab" text-anchor="end" x="${(+X(core) - 14).toFixed(1)}" y="${(+Y(core) + 4).toFixed(1)}">${esc(t("mapCore"))}</text>` + far;
    const stn = STARTS.map((s) => `<rect class="st" x="${X(s) - 5}" y="${Y(s) - 5}" width="10" height="10"><title>${esc(nm(s))}</title></rect><text class="lab" text-anchor="end" x="${(+X(s) - 9).toFixed(1)}" y="${(+Y(s) + 4).toFixed(1)}">${esc(nm(s))}${arrowOf(s)}</text>`).join("");
    const legend = `<div class="legend">${[0, 1, 2, 3, 4].map((lv) => lvTag(lv)).join("")}</div>`;
    const me = st.from && st.from.gps ? `<circle class="me" cx="${X(st.from)}" cy="${Y(st.from)}" r="6"/>` : "";
    return `<figure class="map"><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(t("mapNote"))}"><text x="${W - 8}" y="14" class="north">N▲</text>${stn}${dots}${lab}${me}</svg><figcaption>${esc(t("mapNote"))}</figcaption>${legend}</figure>`;
  }

  function dayHour() {
    const opts = []; for (let h = H0; h <= H1; h++) opts.push(`<option value="${h}"${h === st.hour ? " selected" : ""}>${esc(hourOf(h))}</option>`);
    return `<div class="row"><button type="button" class="chip" data-hol="0" aria-pressed="${!st.hol}">${esc(t("weekday"))}</button><button type="button" class="chip" data-hol="1" aria-pressed="${st.hol}">${esc(t("holiday"))}</button>
      <select id="hour" aria-label="${esc(hourOf(st.hour))}">${opts.join("")}</select></div>`;
  }

  function nowHTML() {
    const core = level(byId("ichibangai"), st.hour, st.hol);
    const list = suggest(st.from, st.hour, st.hol, 5);
    const starts = STARTS.map((s) => `<button type="button" class="chip" data-from="${s.id}" aria-pressed="${st.from === s}">${esc(nm(s))}</button>`).join("");
    const items = list.map((x, i) => `<li data-id="${x.s.id}"><div class="pl"><b><span class="no">${i + 1}</span> ${esc(nm(x.s))}</b>${lvTag(x.lv)}<span class="dd">${esc(dirName(x.b))} ${esc(dist(x.d))}・${esc(fmt(t("walk"), { m: walkMin(x.d) }))}</span>${x.s.day ? `<span class="nt">${esc(t("dayOnly"))}</span>` : ""}</div></li>`).join("");
    const hidden = SPOTS.some((s) => !isOpen(s, st.hour));
    return `${dayHour()}
      <p class="big ${core >= 3 ? "hot" : ""}" id="core">${esc(fmt(t("coreNow"), { t: t("lv")[core] }))} ${core >= 3 ? esc(t("coreTip")) : ""}</p>
      <h2>${esc(t("from"))}</h2><div class="row">${starts}<button type="button" class="chip" id="gps" aria-pressed="${!!(st.from && st.from.gps)}">${esc(t("gps"))}</button></div>
      ${st.gpsMsg ? `<p class="hint" id="gps-msg">${esc(st.gpsMsg)}</p>` : ""}
      <h2>${esc(t("alt"))}</h2>${list.length ? `<ol class="places">${items}</ol>` : `<p class="warn">${esc(t("noAlt"))}</p>`}
      ${hidden ? `<p class="hint">${esc(t("closedNote"))}</p>` : ""}
      <h2>${esc(t("mapTitle"))}</h2>${map(st.hour, st.hol, list.map((x) => x.s.id))}`;
  }

  function timeHTML() {
    const s = byId(st.spot);
    const chips = SPOTS.map((x) => `<button type="button" class="chip" data-spot="${x.id}" aria-pressed="${x.id === st.spot}">${esc(nm(x))}</button>`).join("");
    // 棒グラフは目で見る人のため。同じ中身を読み上げ用の一覧にも書く（棒は aria-hidden）
    const bars = [], hours = []; for (let h = H0; h <= H1; h++) {
      const open = isOpen(s, h), lv = level(s, h, st.hol);
      hours.push(`<li>${esc(hourOf(h))}：${esc(open ? t("lv")[lv] : t("closed"))}</li>`);
      bars.push(`<div class="bar${h === st.hour ? " cur" : ""}" data-h="${h}"><span class="b lv${open ? lv : "x"}" style="height:${open ? 12 + lv * 22 : 4}px"></span><small>${h}</small></div>`);
    }
    const b = bestHour(s, st.hol);
    const yr = s.visitors ? `<p class="hint">${esc(fmt(t("year"), { n: s.visitors, N: (s.visitors * 10000).toLocaleString("en-US") }))}</p>` : "";
    return `${dayHour()}<h2>${esc(t("pick"))}</h2><div class="row">${chips}</div>
      <p class="big" id="best">${esc(fmt(t("best"), { p: nm(s), h: hourOf(b) }))}</p>${yr}
      <div class="bars" aria-hidden="true">${bars.join("")}</div>
      <ul class="sr" id="bars-text" aria-label="${esc(nm(s))}">${hours.join("")}</ul>
      ${s.day ? `<p class="hint">${esc(t("dayOnly"))}</p>` : ""}`;
  }

  function courseHTML() {
    return COURSES.map((c) => {
      const d = courseLen(c);
      const stops = c.stops.map((id) => { const s = byId(id); return `<li>${esc(nm(s))} ${isOpen(s, st.hour) ? lvTag(level(s, st.hour, st.hol)) : ""}</li>`; }).join("");
      return `<section class="course" data-course="${c.id}"><h2>${esc(t("c_" + c.id))}</h2><p>${esc(t("d_" + c.id))}</p>
        <p class="hint">${esc(fmt(t("courseLen"), { km: (d * 1.3 / 1000).toFixed(1), m: walkMin(d) }))}<br>${esc(fmt(t("courseBest"), { w: t("w_" + c.id) }))}</p><ol class="stops">${stops}</ol></section>`;
    }).join("") + `<p class="hint">${esc(fmt(t("coreNow"), { t: t("lv")[level(byId("ichibangai"), st.hour, st.hol)] }))}（${esc(hourOf(st.hour))}・${esc(t(st.hol ? "holiday" : "weekday"))}）</p>`;
  }

  // 見本の店の「いま空いてます」。画面は手元の値で描き、保存（localStorage）はできるときだけ（保存できない端末でもボタンが効くように）
  const DEFAULT_OPEN = { s1: "1", s2: "0", s3: "1" };
  const shopState = {};
  for (const s of SHOPS) shopState[s.id] = (LS("ks-shop-" + s.id) || DEFAULT_OPEN[s.id]) === "1";
  const shopOpen = (id) => shopState[id];
  function shopHTML() {
    const items = SHOPS.map((s) => {
      const o = shopOpen(s.id);
      return `<li data-shop="${s.id}" class="${o ? "open" : ""}"><div class="pl"><b>${esc(nm(s))}</b><span class="nt">${esc(t("k_" + s.kind))}・${esc(fmt(t("near"), { p: nm(byId(s.near)) }))}</span>
        <span class="lv ${o ? "lv0" : "lv3"}">${esc(t(o ? "open" : "busy"))}</span>${o ? `<span class="nt">${esc(t("perk"))}</span>` : ""}</div></li>`;
    }).join("");
    const first = SHOPS[0], o = shopOpen(first.id);
    return `<h2>${esc(t("shopHead"))}</h2><p class="warn">${esc(t("shopNote"))}</p><ul class="places">${items}</ul>
      <section class="owner"><h2>${esc(t("ownerHead"))}</h2><p class="hint">${esc(t("ownerNote"))}</p><p><b>${esc(nm(first))}</b></p>
      <button type="button" class="main" id="owner" data-on="${o ? 1 : 0}">${esc(t(o ? "ownerOff" : "ownerOn"))}</button></section>`;
  }

  function infoHTML() {
    const ai = t("aiNote");
    return `<h2>${esc(t("infoHead"))}</h2>${ai ? `<p class="warn" id="ai">${esc(ai)}</p>` : ""}
      <p>${esc(t("info1"))}</p><p>${esc(t("info2"))}</p><p class="warn">${esc(t("info3"))}</p><p>${esc(t("info4"))}</p><p class="hint">${esc(t("unofficial"))}</p>
      <h2>${esc(t("srcHead"))}</h2><ul class="src">
      <li><a href="https://www.mlit.go.jp/kankocho/content/001878823.pdf" rel="noopener">観光庁「川越市におけるオーバーツーリズム対策事業」（令和6年度）</a></li>
      <li><a href="https://www.mlit.go.jp/kankocho/content/001995775.pdf" rel="noopener">観光庁「埼玉県川越市」（令和7年度）</a></li>
      <li><a href="https://www.city.kawagoe.saitama.jp/_res/projects/default_project/_page_/001/011/627/r6.pdf" rel="noopener">川越市 令和6年 観光アンケート調査報告書</a></li>
      <li>国土地理院「住所検索」（場所の座標）</li></ul>`;
  }

  let gpsGen = 0;
  const VIEWS = { now: nowHTML, time: timeHTML, course: courseHTML, shop: shopHTML, info: infoHTML };
  function render() {
    document.documentElement.lang = st.lang === "zh" ? "zh-Hans" : st.lang;
    document.title = t("title");
    $("#title").textContent = t("title");
    $("#sub").textContent = t("sub");
    $("#lang-label").textContent = t("lang");
    const sel = $("#lang");
    if (!sel.options.length) sel.innerHTML = LANGS.map(([c, n]) => `<option value="${c}">${n}</option>`).join("");
    sel.value = st.lang;
    for (const b of document.querySelectorAll("[role=tab]")) { b.textContent = t("tab" + b.dataset.tab[0].toUpperCase() + b.dataset.tab.slice(1)); b.setAttribute("aria-selected", String(b.dataset.tab === st.tab)); b.setAttribute("aria-controls", "view"); }
    const view = $("#view");
    view.setAttribute("aria-labelledby", "tab-" + st.tab);
    // 描き直すと押したボタンが消えるので、同じ役目のボタンに手元の位置（フォーカス）を戻す（キーボードで使う人のため）
    const a = document.activeElement, keep = a && view.contains(a) && a !== view ? focusKey(a) : null;
    view.innerHTML = VIEWS[st.tab]();
    if (keep) { const n = view.querySelector(keep); if (n) n.focus(); }
  }
  function focusKey(el) {
    if (el.id) return "#" + CSS.escape(el.id);
    for (const k of ["hol", "from", "spot"]) if (el.dataset[k] !== undefined) return `[data-${k}="${CSS.escape(el.dataset[k])}"]`;
    return null;
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.tab) { st.tab = b.dataset.tab; render(); $("#view").focus(); return; }
    if (b.dataset.hol !== undefined) { st.hol = b.dataset.hol === "1"; return render(); }
    if (b.dataset.from) { gpsGen++; st.from = STARTS.find((s) => s.id === b.dataset.from); st.gpsMsg = ""; return render(); }
    if (b.dataset.spot) { st.spot = b.dataset.spot; return render(); }
    if (b.id === "owner") { const id = SHOPS[0].id; shopState[id] = !shopState[id]; LS("ks-shop-" + id, shopState[id] ? "1" : "0"); return render(); }
    if (b.id === "gps") {
      if (!navigator.geolocation) { st.gpsMsg = t("gpsNg"); return render(); }
      // 待っているあいだに駅を選び直したら、遅れて届いた現在地では上書きしない（いちばん新しい頼みの答えだけ使う）
      const gen = ++gpsGen;
      navigator.geolocation.getCurrentPosition((p) => {
        if (gen !== gpsGen) return;
        const here = { lat: p.coords.latitude, lon: p.coords.longitude, gps: true };
        if (geo(here, byId("ichibangai")).d > 15000) { st.gpsMsg = t("gpsFar"); return render(); }
        st.from = here; st.gpsMsg = t("gpsOk"); render();
      }, () => { if (gen !== gpsGen) return; st.gpsMsg = t("gpsNg"); render(); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "lang") { st.lang = e.target.value; LS("ks-lang", st.lang); render(); }
    if (e.target.id === "hour") { st.hour = Number(e.target.value); render(); }
  });
  render();
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("./sw.js").catch(() => {});
})();
