# AGENTS.md

川越の観光客を、混んでいる一番街から空いている場所・時間・お店へ分ける周遊ガイドの試作（PWA）。インストール不要・4言語・一度開けば電波なしで使える。GitHub Pages で公開（main の /）。川越商工会議所の創業スクールの発表用（2026-11-21〜）。

## 準備（最初に一度）

```bash
bash scripts/setup.sh   # 検査の道具（Playwright）
```

## 作り方（index.html は自動で作るファイル。手で直さない）

```bash
python3 tools/build.py   # src/ + data/spots.js → index.html（1つのファイルにまとめる。標準ライブラリだけ）
```

## push する前の確認

```bash
node qa/run.mjs
```

## 決まり

- 外へ通信する部品を足さない（CSP の connect-src は 'self' だけ）。現在地は端末の中だけで使う。
- 混み具合は目安（地区ごとの人出の差と、ふつうの時間帯の形から作ったもの）。測った数のように見せない。「このアプリ」に目安であることを出し続ける。
- 年の人出などの数は出典（観光庁・川越市の資料）の数だけを使い、data/spots.js の頭に出典を書く。
- お店は作り話の見本だけ（名前に「見本」）。実在の店を載せるのは、その店の許しを得てから。
- 場所の座標は国土地理院の住所検索で求める。足すときも同じやり方で。
- 日本語以外は AI の訳で人の確認がまだ。確認したら aiNote を空にする。言葉を足すときは4言語すべてに足す（qa/run.mjs が見る）。
- 川越市・観光協会のものと思わせない（非公式と書く。市や協会の名前・ロゴを看板に使わない）。

## 共通のきまり

- PR の作り方・マージの仕方は satou-aaaaa/shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md` に従う。
- Claude 以外の AI・人が作業するときは、shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。
