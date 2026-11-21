// 川越さんぽの検査。データ（座標が川越の中・名前が4言語）・言葉のそろい・index.html が src と同じか・混み具合の目安の形・
// 画面（いま空いている場所・何時が空く・コース・お店のボタン・4言語）・スマホ幅・電波なしで開けるか・PWA の返事の仕方を見る。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import path from "node:path";
import { checkSwStall } from "./sw-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail).slice(0, 400) });
const read = (f) => readFileSync(path.join(root, f), "utf8");

// ---- 1. ブラウザを使わない検査 ----
const ctx = { window: {} };
vm.runInNewContext(read("data/spots.js") + read("src/i18n.js"), ctx);
const { SPOTS, STARTS, COURSES, SHOPS, T, LANGS } = ctx.window;
const inKawagoe = (p) => p.lat > 35.85 && p.lat < 35.98 && p.lon > 139.38 && p.lon < 139.56;
check("データ：場所が10以上・座標が川越市のあたり", SPOTS.length >= 10 && SPOTS.concat(STARTS).every(inKawagoe), SPOTS.concat(STARTS).filter((p) => !inKawagoe(p)).map((p) => p.id));
check("データ：場所・駅・見本の店の名前が4言語ある", SPOTS.concat(STARTS, SHOPS).every((s) => LANGS.every(([c]) => s.name[c])));
check("データ：id が重ならない", new Set(SPOTS.map((s) => s.id)).size === SPOTS.length);
check("データ：混み方の型が core・mid・quiet のどれか", SPOTS.every((s) => ["core", "mid", "quiet"].includes(s.kind)));
check("データ：コースの場所・見本の店の近くの場所が全部ある", COURSES.every((c) => c.stops.every((id) => SPOTS.some((s) => s.id === id))) && SHOPS.every((s) => SPOTS.some((x) => x.id === s.near)));
check("データ：見本の店は名前に「見本」と付く（実在の店と思わせない）", SHOPS.every((s) => /見本/.test(s.name.ja) && /sample/.test(s.name.en)));
check("データ：一番街の年の人出は出典の数（271万人）", SPOTS.find((s) => s.id === "ichibangai").visitors === 271);
{
  const keys = Object.keys(T.ja), miss = [];
  for (const [c] of LANGS) {
    for (const k of keys) {
      const a = T.ja[k], b = T[c][k];
      if (b === undefined || (b === "" && a !== "")) miss.push(`${c}.${k}`);
      else if (Array.isArray(a) && (!Array.isArray(b) || a.length !== b.length)) miss.push(`${c}.${k}（数）`);
      else if (typeof a === "string" && k !== "year" && (a.match(/\{\w+\}/g) || []).join() !== (String(b).match(/\{\w+\}/g) || []).join()) miss.push(`${c}.${k}（{}）`);
    }
    for (const k of Object.keys(T[c])) if (!(k in T.ja)) miss.push(`${c}.${k}（余り）`);
    for (const id of COURSES.map((x) => x.id)) for (const p of ["c_", "d_", "w_"]) if (!T[c][p + id]) miss.push(`${c}.${p}${id}`);
  }
  check("言葉：4言語で同じキー・同じ数・同じ差し込み・コースの言葉がそろう", miss.length === 0, miss.join(" "));
  check("言葉：日本語以外は AI の訳だと書いてある", LANGS.filter(([c]) => c !== "ja").every(([c]) => /AI/.test(T[c].aiNote)));
}
{
  const idx = read("index.html");
  const stale = ["src/style.css", "data/spots.js", "src/i18n.js", "src/app.js"].filter((f) => !idx.includes(read(f).replace(/\n+$/, "")));
  check("index.html が src/・data/ と同じ（直したら python3 tools/build.py）", stale.length === 0, stale.join(" "));
  const kb = Buffer.byteLength(idx) / 1024;
  check("index.html が軽い（混んだ回線でも開けるよう 150KB 未満）", kb < 150, kb.toFixed(1) + "KB");
  check("index.html は外のサイトから何も読み込まない（電波なしで全部そろう）", !/<(script|link|img)[^>]+(src|href)="https?:/i.test(idx));
  check("index.html は外へ通信しない（CSP の connect-src は 'self' だけ）", /connect-src 'self';/.test(idx));
  check("index.html の最初の行が <!doctype html>（標準モード）", idx.startsWith("<!doctype html>"));
}
{
  const sw = read("sw.js");
  const shell = JSON.parse(/const SHELL = (\[[^\]]*\])/.exec(sw)[1].replace(/'/g, '"'));
  check("PWA：保存するファイルが全部ある", shell.filter((f) => f !== "./").every((f) => existsSync(path.join(root, f))), shell.join(" "));
  const st = await checkSwStall(sw);
  check("PWA：通信が止まっても保存した画面に切り替わる（shared-workflows template/qa/sw-check.mjs）", st.ok, JSON.stringify(st));
}

// ---- 2. ブラウザで ----
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".css": "text/css" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" });
  res.end(readFileSync(f));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  // 時計を土曜の13時に合わせる（混む時間の答えを決まったものにする）
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, geolocation: { latitude: 35.916328, longitude: 139.489548 }, permissions: ["geolocation"], locale: "ja-JP", timezoneId: "Asia/Tokyo" });
  await context.addInitScript(() => { const T0 = new Date("2026-11-21T13:10:00+09:00").getTime(), D = Date, off = T0 - D.now(); window.Date = class extends D { constructor(...a) { super(...(a.length ? a : [D.now() + off])); } static now() { return D.now() + off; } }; });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector("#tab-now").textContent.length > 0);
  check("開く：日本語で、5つのタブがある", (await page.locator("[role=tab]").count()) === 5 && (await page.title()) === "川越さんぽ");

  // 混み具合の目安の形（KS は検査用の口）
  const shape = await page.evaluate(() => {
    const s = (id) => SPOTS.find((x) => x.id === id);
    return {
      corePeak: KS.level(s("ichibangai"), 13, true), coreMorning: KS.level(s("ichibangai"), 9, true), coreWeekday: KS.level(s("ichibangai"), 13, false),
      quietPeak: Math.max(...SPOTS.filter((x) => x.kind === "quiet").map((x) => KS.level(x, 13, true))),
      allRange: SPOTS.every((x) => [8, 10, 12, 14, 16, 18, 20].every((h) => [true, false].every((hol) => { const v = KS.level(x, h, hol); return v >= 0 && v <= 4; }))),
      bestCore: KS.bestHour(s("ichibangai"), true), bestDay: KS.bestHour(s("honmaru"), true),
    };
  });
  check("目安：一番街は休日の昼が「とても混む」・朝は「すいている」・平日は休日より空く", shape.corePeak === 4 && shape.coreMorning === 0 && shape.coreWeekday < shape.corePeak, JSON.stringify(shape));
  check("目安：ふだん空いている場所は休日の昼でも「やや混む」より下", shape.quietPeak <= 1, shape.quietPeak);
  check("目安：どの場所・時間も 0〜4 の段", shape.allRange);
  check("目安：一番空いている時間は開いている時間から選ぶ（本丸御殿は9〜16時）", shape.bestCore === 9 && shape.bestDay >= 9 && shape.bestDay < 17, JSON.stringify(shape));

  // いま：土曜13時 → 一番街は混む → 空いている場所が出る
  check("いま：土曜の13時は休日・13時が選ばれている", (await page.locator("[data-hol='1']").getAttribute("aria-pressed")) === "true" && (await page.locator("#hour").inputValue()) === "13");
  check("いま：一番街が「とても混む」と出て、空いている場所から回るようすすめる", /とても混む/.test(await page.locator("#core").textContent()) && /おすすめ/.test(await page.locator("#core").textContent()));
  const ids = await page.locator(".places li").evaluateAll((els) => els.map((e) => e.dataset.id));
  const kinds = await page.evaluate((ids) => ids.map((id) => SPOTS.find((s) => s.id === id).kind), ids);
  check("いま：空いている場所が5つ出る・一番街のまわり（core）は出ない", ids.length === 5 && !kinds.includes("core"), ids.join(" "));
  check("いま：方角・距離・歩く分がある", /\d+m|km/.test(await page.locator(".places .dd").first().textContent()) && /分/.test(await page.locator(".places .dd").first().textContent()));
  {
    const d = await page.evaluate((ids) => ids.map((id) => [KS.level(SPOTS.find((s) => s.id === id), 13, true), KS.geo(STARTS[1], SPOTS.find((s) => s.id === id)).d]), ids);
    const sorted = d.every((x, i) => i === 0 || d[i - 1][0] < x[0] || (d[i - 1][0] === x[0] && d[i - 1][1] <= x[1]));
    check("いま：空いている順・同じなら近い順（本川越駅から）", sorted, JSON.stringify(d));
  }
  check("地図：場所の数だけ丸・駅の数だけ四角・北の印", (await page.locator(".map circle.m").count()) === SPOTS.length && (await page.locator(".map .st").count()) === STARTS.length && (await page.locator(".map .north").count()) === 1);

  await page.selectOption("#hour", "9");
  check("いま：9時にすると一番街は「すいている」", /すいている/.test(await page.locator("#core").textContent()));
  await page.selectOption("#hour", "19");
  const nightIds = await page.locator(".places li").evaluateAll((els) => els.map((e) => e.dataset.id));
  const dayOnly = await page.evaluate(() => SPOTS.filter((s) => s.day).map((s) => s.id));
  check("いま：19時は日中だけの場所（本丸御殿など）を出さず、そう書く", nightIds.every((id) => !dayOnly.includes(id)) && /日中だけの場所/.test(await page.locator("main").innerText()), nightIds.join(" "));
  await page.selectOption("#hour", "13");
  await page.click("[data-hol='0']");
  check("いま：平日にすると一番街の目安が下がる", !/とても混む/.test(await page.locator("#core").textContent()));
  await page.click("[data-hol='1']");

  // 現在地（仙波東照宮のあたり）
  await page.click("#gps");
  await page.waitForFunction(() => /現在地から/.test((document.querySelector("#gps-msg") || {}).textContent || ""));
  check("現在地：一番近い空いている場所（仙波東照宮）が先頭", (await page.locator(".places li").first().getAttribute("data-id")) === "toshogu");
  check("地図：現在地の点が出る（枠の外でも端に寄せる）", (await page.locator(".map .me").count()) === 1);
  await context.setGeolocation({ latitude: 35.68, longitude: 139.76 });
  await page.click("#gps");
  await page.waitForFunction(() => /川越の外/.test((document.querySelector("#gps-msg") || {}).textContent || ""));
  check("現在地：川越の外なら、そう知らせて出発の場所を選んでもらう", true);
  await page.click("[data-from=kawagoe-st]");

  // 何時が空く？
  await page.click("#tab-time");
  check("何時が空く？：14本の棒（8〜21時）・いまの時間に印", (await page.locator(".bar").count()) === 14 && (await page.locator(".bar.cur").getAttribute("data-h")) === "13");
  check("何時が空く？：一番街は9時ごろが空いている目安・年の人出 約271万人", /9時/.test(await page.locator("#best").textContent()) && /271万/.test(await page.locator("main").innerText()));
  check("何時が空く？：読み上げ用に、時間ごとの混み具合の一覧（14行）がある", (await page.locator("#bars-text li").count()) === 14 && /13時：とても混む/.test(await page.locator("#bars-text").textContent()));
  await page.focus("[data-spot=hikawa]"); await page.keyboard.press("Enter");
  check("キーボード：場所を選んでも、押したボタンに手元の位置（フォーカス）が残る", await page.evaluate(() => document.activeElement && document.activeElement.dataset.spot === "hikawa"));
  check("タブ：中身の欄が選んだタブの名前を持つ（aria-labelledby・aria-controls）", (await page.locator("#view").getAttribute("aria-labelledby")) === "tab-time" && (await page.locator("#tab-time").getAttribute("aria-controls")) === "view");
  await page.click("[data-spot=honmaru]");
  check("何時が空く？：本丸御殿は日中だけと書く・17時からは棒が灰色", /日中だけ/.test(await page.locator("main").innerText()) && (await page.locator(".bar[data-h='18'] .b.lvx").count()) === 1);

  // コース
  await page.click("#tab-course");
  check("コース：4つ・どれも距離と歩く分・おすすめの時間がある", (await page.locator(".course").count()) === COURSES.length && (await page.locator(".course .hint").allTextContents()).every((s) => /km/.test(s) && /分/.test(s) && /おすすめの時間/.test(s)));
  {
    const len = await page.evaluate(() => COURSES.map((c) => KS.courseLen(c)));
    check("コース：どれも歩ける長さ（直線で300m〜3km）", len.every((d) => d > 300 && d < 3000), len.map((d) => Math.round(d)).join(" "));
  }

  // お店
  await page.click("#tab-shop");
  check("お店：見本だと書いてある・3つ出る", /作り話/.test(await page.locator("main").innerText()) && (await page.locator("[data-shop]").count()) === 3);
  const before = await page.locator("[data-shop=s1]").getAttribute("class");
  await page.click("#owner");
  const after = await page.locator("[data-shop=s1]").getAttribute("class");
  check("お店：お店のボタンで「いま空いてます」が消える・もう一度押すと出る", before === "open" && after === "" && (await page.click("#owner"), (await page.locator("[data-shop=s1]").getAttribute("class")) === "open"));
  check("お店：空いている店に特典の見本が出る", /特典/.test(await page.locator("[data-shop=s1]").innerText()));

  {
    // 保存（localStorage）が使えない端末でも、お店のボタンが効く
    const nc = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: "ja-JP" });
    await nc.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
    const np = await nc.newPage();
    await np.goto(base); await np.waitForFunction(() => document.querySelector("#tab-now").textContent.length > 0);
    await np.click("#tab-shop"); await np.click("#owner");
    check("お店：保存が使えない端末でも、ボタンで「いま空いてます」が消える", (await np.locator("[data-shop=s1]").getAttribute("class")) === "");
    await nc.close();
  }
  {
    // 暗い画面：選んだボタンの文字が背景と見分けられる（4.5:1 以上）
    const dc = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: "ja-JP", colorScheme: "dark" });
    const dp = await dc.newPage();
    await dp.goto(base); await dp.waitForFunction(() => document.querySelector("#tab-now").textContent.length > 0);
    const ratio = await dp.evaluate(() => {
      const rgb = (c) => c.match(/\d+/g).slice(0, 3).map(Number);
      const lum = (c) => { const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      return [...document.querySelectorAll("[aria-selected=true], .chip[aria-pressed=true]")].map((el) => { const cs = getComputedStyle(el), a = lum(cs.color), b = lum(cs.backgroundColor); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); });
    });
    check("暗い画面：選んだタブ・ボタンの文字のコントラストが 4.5:1 以上", ratio.length > 0 && ratio.every((r) => r >= 4.5), ratio.map((r) => r.toFixed(1)).join(" "));
    await dc.close();
  }

  // このアプリ：目安であること・出典
  await page.click("#tab-info");
  const info = await page.locator("main").innerText();
  check("このアプリ：目安であり測ったものではない・非公式・出典がある", /目安/.test(info) && /測ったものではありません/.test(info) && /非公式/.test(info) && (await page.locator(".src li").count()) >= 3);

  // 4言語
  for (const [c] of LANGS) {
    await page.selectOption("#lang", c);
    for (const tab of ["now", "time", "course", "shop", "info"]) {
      await page.click(`#tab-${tab}`);
      const txt = await page.locator("body").innerText();
      if (/undefined|NaN|\{\w+\}|null/.test(txt)) check(`言葉：${c} の ${tab} に変な文字がない`, false, txt.slice(0, 200));
    }
  }
  check("言葉：4言語 × 5タブで undefined などが出ない", !results.some((r) => r.name.startsWith("言葉：") && r.name.includes("変な文字") && !r.ok));
  await page.selectOption("#lang", "en");
  await page.click("#tab-time"); await page.click("[data-spot=ichibangai]");
  check("英語：見出しも英語・html の lang も en・年の人出が 2,710,000", (await page.locator("#title").textContent()) === "Kawagoe Quiet Walk" && (await page.evaluate(() => document.documentElement.lang)) === "en" && /2,710,000/.test(await page.locator("main").innerText()));
  await page.click("#tab-info");
  check("英語：AI が訳した注意が出る", /translated by AI/.test(await page.locator("#ai").textContent()));
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#tab-now").textContent.length > 0);
  check("言葉：選んだ言語を覚えている", (await page.locator("#title").textContent()) === "Kawagoe Quiet Walk");
  await page.selectOption("#lang", "ja");

  // スマホ幅：横にはみ出さない
  for (const tab of ["now", "time", "course", "shop", "info"]) {
    await page.click(`#tab-${tab}`);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 0) check(`スマホ幅（360px）：${tab} が横にはみ出さない`, false, over + "px");
  }
  check("スマホ幅（360px）：どのタブも横にはみ出さない", !results.some((r) => r.name.startsWith("スマホ幅（360px）：") && !r.ok));
  const small = await page.evaluate(() => [...document.querySelectorAll("button, select")].filter((b) => b.offsetParent && Math.round(b.getBoundingClientRect().height) < 44).length);
  check("押しやすさ：ボタンは高さ44px以上", small === 0, small);

  // 電波なし：保存されたあと、オフラインで開き直しても動く
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== null, null, { timeout: 15000 }).catch(() => {});
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#tab-now").textContent.length > 0, null, { timeout: 15000 });
  await page.click("#tab-now");
  check("電波なし：開き直しても空いている場所が出る", (await page.locator(".places li").count()) === 5);
  await context.setOffline(false);
  check("エラーが出ない", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
  server.close();
}

const ng = results.filter((r) => !r.ok);
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), `# QA ${ng.length ? "❌" : "✅"} ${results.length - ng.length}/${results.length}\n\n` + results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail && !r.ok ? `\n  - ${r.detail}` : ""}`).join("\n") + "\n");
for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.name}${!r.ok && r.detail ? " — " + r.detail : ""}`);
console.log(`\n${results.length - ng.length}/${results.length}`);
process.exit(ng.length ? 1 : 0);
