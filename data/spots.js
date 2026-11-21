// 川越さんぽの場所・コース・見本の店。手で直すファイル。
// 座標：国土地理院「住所検索」（msearch.gsi.go.jp）で住所から求めた（2026-11-21）。足すときも同じやり方で。
// 年の人出（visitors、万人）：観光庁「川越市におけるオーバーツーリズム対策事業」（令和6年度）の地区別の観光客数。
//   https://www.mlit.go.jp/kankocho/content/001878823.pdf  一番街周辺271・喜多院26・氷川神社32・伊佐沼34
// kind（混み方の型）：core＝一番街のまわり（人出が集まる）／mid＝中くらい／quiet＝ふだん空いている。これは試作の仮の分け方。
// far：地図の枠に入れず端に寄せる遠い場所（矢印を付ける）。
// day：日中（9〜17時）だけ入れる場所。開いている時間は目安なので、行く前に公式で確かめる（画面にも出す）。
window.SPOTS = [
  { id: "ichibangai", kind: "core", lat: 35.9228, lon: 139.4826, visitors: 271, name: { ja: "蔵造りの町並み（一番街）", en: "Kurazukuri Street (Ichibangai)", zh: "藏造老街（一番街）", ko: "구라즈쿠리 거리(이치방가이)" } },
  { id: "tokinokane", kind: "core", lat: 35.923595, lon: 139.483627, name: { ja: "時の鐘", en: "Toki-no-Kane Bell Tower", zh: "时之钟", ko: "도키노카네(시간의 종)" } },
  { id: "kashiya", kind: "core", lat: 35.92411, lon: 139.480865, name: { ja: "菓子屋横丁", en: "Kashiya Yokocho (Candy Alley)", zh: "点心横丁", ko: "가시야 요코초(과자 골목)" } },
  { id: "matsuri", kind: "core", day: true, lat: 35.924232, lon: 139.48262, name: { ja: "川越まつり会館", en: "Kawagoe Festival Museum", zh: "川越祭会馆", ko: "가와고에 마쓰리 회관" } },
  { id: "hikawa", kind: "mid", lat: 35.927532, lon: 139.488831, visitors: 32, name: { ja: "川越氷川神社", en: "Kawagoe Hikawa Shrine", zh: "川越冰川神社", ko: "가와고에 히카와 신사" } },
  { id: "renkeiji", kind: "mid", lat: 35.919285, lon: 139.482162, name: { ja: "蓮馨寺", en: "Renkei-ji Temple", zh: "莲馨寺", ko: "렌케이지(절)" } },
  { id: "kumano", kind: "mid", lat: 35.919167, lon: 139.483307, name: { ja: "川越熊野神社", en: "Kawagoe Kumano Shrine", zh: "川越熊野神社", ko: "가와고에 구마노 신사" } },
  { id: "kurari", kind: "mid", lat: 35.916283, lon: 139.48378, name: { ja: "小江戸蔵里", en: "Koedo Kurari", zh: "小江户藏里", ko: "고에도 구라리" } },
  { id: "kitain", kind: "mid", day: true, lat: 35.917866, lon: 139.488556, visitors: 26, name: { ja: "喜多院", en: "Kita-in Temple", zh: "喜多院", ko: "기타인(절)" } },
  { id: "toshogu", kind: "quiet", lat: 35.916328, lon: 139.489548, name: { ja: "仙波東照宮", en: "Senba Toshogu Shrine", zh: "仙波东照宫", ko: "센바 도쇼구" } },
  { id: "nakain", kind: "quiet", lat: 35.915508, lon: 139.490341, name: { ja: "中院", en: "Naka-in Temple", zh: "中院", ko: "나카인(절)" } },
  { id: "honmaru", kind: "quiet", day: true, lat: 35.923862, lon: 139.491119, name: { ja: "川越城本丸御殿", en: "Kawagoe Castle Honmaru Palace", zh: "川越城本丸御殿", ko: "가와고에성 혼마루고텐" } },
  { id: "miyoshino", kind: "quiet", lat: 35.923798, lon: 139.492615, name: { ja: "三芳野神社", en: "Miyoshino Shrine", zh: "三芳野神社", ko: "미요시노 신사" } },
  { id: "museum", kind: "quiet", day: true, lat: 35.925831, lon: 139.491272, name: { ja: "川越市立博物館", en: "Kawagoe City Museum", zh: "川越市立博物馆", ko: "가와고에 시립 박물관" } },
  { id: "isanuma", kind: "quiet", far: true, lat: 35.926899, lon: 139.512924, visitors: 34, name: { ja: "伊佐沼", en: "Isanuma Pond", zh: "伊佐沼", ko: "이사누마(늪)" } },
];
// 出発する場所（駅）。座標は国土地理院「住所検索」で駅の住所から求めた
window.STARTS = [
  { id: "kawagoe-st", lat: 35.909424, lon: 139.479904, name: { ja: "川越駅", en: "Kawagoe Station", zh: "川越站", ko: "가와고에역" } },
  { id: "honkawagoe-st", lat: 35.914635, lon: 139.481705, name: { ja: "本川越駅", en: "Hon-Kawagoe Station", zh: "本川越站", ko: "혼카와고에역" } },
];
// コース（場所の id の順に歩く）
window.COURSES = [
  { id: "senba", stops: ["renkeiji", "kumano", "kitain", "toshogu", "nakain"] },
  { id: "castle", stops: ["honmaru", "miyoshino", "museum", "hikawa"] },
  { id: "morning", stops: ["tokinokane", "ichibangai", "kashiya", "matsuri"] },
  { id: "night", stops: ["kumano", "ichibangai", "tokinokane", "hikawa"] },
];
// 見本の店（作り話。実在の店ではない）。本番は、お店が自分で「いま空いてます」を出す
window.SHOPS = [
  { id: "s1", near: "kitain", name: { ja: "蔵カフェ こまち（見本）", en: "Kura Cafe Komachi (sample)", zh: "藏咖啡 小町（示例）", ko: "구라 카페 고마치(예시)" }, kind: "cafe" },
  { id: "s2", near: "honmaru", name: { ja: "芋どら やまぶき（見本）", en: "Imo-Dora Yamabuki (sample)", zh: "红薯铜锣烧 山吹（示例）", ko: "고구마 도라야키 야마부키(예시)" }, kind: "sweets" },
  { id: "s3", near: "renkeiji", name: { ja: "手ぬぐい ささら（見本）", en: "Tenugui Sasara (sample)", zh: "手巾 笹良（示例）", ko: "데누구이 사사라(예시)" }, kind: "craft" },
];
