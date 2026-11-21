#!/usr/bin/env python3
# index.html を作る（src/ と data/spots.js を1つのファイルにまとめる。1つにすると、電波が無くても一度保存すれば動く）。
#   使い方: python3 tools/build.py   （標準ライブラリだけ）
from pathlib import Path
R = Path(__file__).resolve().parent.parent
s = (R / "src/index.src.html").read_text(encoding="utf-8")
for mark, f in [("/*STYLE*/", "src/style.css"), ("/*DATA*/", "data/spots.js"), ("/*I18N*/", "src/i18n.js"), ("/*APP*/", "src/app.js")]:
    body = (R / f).read_text(encoding="utf-8")
    assert mark in s, mark
    assert "</script" not in body.lower(), f
    s = s.replace(mark, body.rstrip("\n"), 1)
s = s.replace("<!doctype html>\n", "<!doctype html>\n<!-- 自動で作るファイル（tools/build.py）。直すのは src/ と data/ -->\n", 1)
(R / "index.html").write_text(s, encoding="utf-8")
print("index.html", len(s.encode()), "bytes")
