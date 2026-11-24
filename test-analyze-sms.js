// Tests for analyze-sms.js. Run: node --test test-analyze-sms.js
// Needs test-vectors.json: expected results generated once and checked in.
// The GSM tables and the segment rules in this file are written independently of the implementation.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { analyzeSms } = require("./analyze-sms.js");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "test-vectors.json"), "utf8"));
const GSM = new Set(data.gsm7);
const EXT = new Set(data.gsm7ext);

// Independent derivation from the bit layout: 140-octet user data, 6-octet header,
// fill bits up to a septet boundary for 7-bit text, a character above U+FFFF is 32 bits.
function referenceSegments(text) {
  const chars = [...text];
  const isEnglish = chars.every((c) => GSM.has(c) || EXT.has(c));
  const bits = chars.map((c) => (isEnglish ? (EXT.has(c) ? 14 : 7) : c.codePointAt(0) > 0xFFFF ? 32 : 16));
  const unit = isEnglish ? 7 : 16;
  const total = bits.reduce((a, b) => a + b, 0);
  if (total <= 140 * 8) return { isUnicode: !isEnglish, segmentSizes: [total / unit], length: total / unit };
  let room = 140 * 8 - 6 * 8;
  if (isEnglish) room -= (7 - ((6 * 8) % 7)) % 7;
  const segmentSizes = [];
  let used = 0;
  for (const b of bits) {
    if (used + b > room) { segmentSizes.push(used / unit); used = 0; }
    used += b;
  }
  segmentSizes.push(used / unit);
  return { isUnicode: !isEnglish, segmentSizes, length: total / unit };
}

const show = (s) => {
  const cps = [...s];
  const body = cps.slice(0, 10).map((c) => (/^[\x20-\x7e]$/.test(c) ? c : "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0"))).join(" ");
  return `[${cps.length} code points] ${body}${cps.length > 10 ? " ..." : ""}`;
};
const expectNoFailures = (failures, label) => {
  assert.equal(failures.length, 0, `${label}: ${failures.length} failures, first: ${JSON.stringify(failures.slice(0, 3), null, 1)}`);
};

test("GSM tables match the reference tables exactly (127 + 10)", () => {
  const src = fs.readFileSync(path.join(__dirname, "analyze-sms.js"), "utf8");
  const m = new Function(src + "\nreturn { GSM_7_CHARS, GSM_7_EXT_CHARS };")();
  assert.deepEqual([...m.GSM_7_CHARS].sort(), [...GSM].sort());
  assert.deepEqual([...m.GSM_7_EXT_CHARS].sort(), [...EXT].sort());
  assert.equal(GSM.size, 127);
  assert.equal(EXT.size, 10);
});

test("worked example: Cat has, ^ Dog has €.", () => {
  assert.deepEqual(analyzeSms("Cat has, ^ Dog has €."), {
    status: { ok: true, response: "Analyzed Successfully" },
    isUnicode: false,
    segments: 1,
    segmentSizes: [23],
    length: 23,
    bySize: {
      "1": { count: 19, consumption: 19, symbols: ["C", "a", "t", " ", "h", "a", "s", ",", " ", " ", "D", "o", "g", " ", "h", "a", "s", " ", "."] },
      "2": { count: 2, consumption: 4, symbols: ["^", "€"] },
    },
  });
});

test("sizes of single characters and sequences (hand-derived)", () => {
  const cases = [
    ["a", false, 1], ["€", false, 2], ["^", false, 2], ["\f", false, 2], ["\n", false, 1], [" ", false, 1],
    ["ক", true, 1], ["আমি", true, 3], ["বাংলাদেশ", true, 8], ["ক্ষ", true, 3],
    ["😀", true, 2], ["👍🏽", true, 4], ["🇧🇩", true, 4], ["1️⃣", true, 3], ["👨‍👩‍👧", true, 8],
    ["❤", true, 1], ["❤️", true, 2], ["☀️", true, 2], ["©", true, 1], ["®", true, 1], ["™", true, 1],
    ["ক\r\n", true, 3], ["ক‌", true, 2], ["é", true, 2], ["é", false, 1],
    ["𝐀", true, 2], ["𠀀", true, 2], ["ক\t", true, 2], ["a ", true, 2], ["a’", true, 2], ["a–", true, 2],
    ["ç", true, 1], ["ú", true, 1], ["ş", true, 1], ["ω", true, 1],
  ];
  const failures = [];
  for (const [text, unicode, length] of cases) {
    const r = analyzeSms(text);
    if (!r.status.ok || r.isUnicode !== unicode || r.length !== length) failures.push({ text: show(text), expected: { unicode, length }, got: { unicode: r.isUnicode, length: r.length } });
  }
  expectNoFailures(failures, "sizes");
});

test("invalid input comes back as an error result and never throws", () => {
  const empty = { "1": { count: 0, consumption: 0, symbols: [] }, "2": { count: 0, consumption: 0, symbols: [] } };
  const expectError = (value, response) => {
    const r = analyzeSms(value);
    assert.deepEqual(r, { status: { ok: false, response }, isUnicode: null, segments: null, segmentSizes: null, length: null, bySize: empty });
  };
  expectError("", "SMS content is empty");
  for (const v of [undefined, null, 0, 123, NaN, true, 10n, Symbol("x"), {}, [], ["a", "€"], () => "a", new String("a"), Object.create(null), { toString() { throw new Error("boom"); } }]) {
    expectError(v, "SMS content must be text");
  }
  const broken = "SMS content has a broken character (half of an emoji)";
  for (const v of ["\ud83d", "\ude00", "a\ud83d", "\ud83d b", "ক\ude00ক", "\ude00\ud83d", "😀\ud83d"]) expectError(v, broken);
  // a valid pair written as two escapes is the same string as the emoji itself
  assert.deepEqual(analyzeSms("👍"), analyzeSms("👍"));
  assert.equal(analyzeSms("👍").length, 2);
});

test("symbols: visible as written, hidden characters labelled, text order kept", () => {
  const label = (cp) => `Non-Printable: U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
  const r = analyzeSms("a b c​d\te\nf‌g‍h️");
  assert.deepEqual(r.bySize["1"].symbols, ["a", " ", "b", label(0xA0), "c", label(0x200B), "d", label(9), "e", label(10), "f", label(0x200C), "g", label(0x200D), "h", label(0xFE0F)]);
  assert.equal(r.isUnicode, true);
  // BMP emoji sit in group 1, emoji above U+FFFF in group 2
  const e = analyzeSms("ক❤😀⭐🎉");
  assert.deepEqual(e.bySize["1"].symbols, ["ক", "❤", "⭐"]);
  assert.deepEqual(e.bySize["2"].symbols, ["😀", "🎉"]);
  // an ordinary space stays a space, a no-break space does not
  assert.deepEqual(analyzeSms("a b").bySize["1"].symbols, ["a", " ", "b"]);
  assert.deepEqual(analyzeSms("a b").bySize["1"].symbols, ["a", label(0xA0), "b"]);
  // astral hidden character: tag character used in emoji flag sequences
  assert.ok(analyzeSms("ক\u{E0067}").bySize["2"].symbols[0].startsWith("Non-Printable: U+E0067"));
  // blank look-alikes and invisible marks are hidden and still take 1 code unit each
  for (const cp of [0x034F, 0x115F, 0x1160, 0x17B4, 0x17B5, 0x2800, 0x3164, 0xFFA0]) {
    const h = analyzeSms("ক" + String.fromCodePoint(cp));
    assert.deepEqual(h.bySize["1"].symbols, ["ক", label(cp)]);
    assert.equal(h.length, 2);
  }
  // visible neighbours are not hidden: a Hangul letter and a Braille dot pattern
  assert.deepEqual(analyzeSms("ক"+String.fromCodePoint(0x3131)).bySize["1"].symbols, ["ক", String.fromCodePoint(0x3131)]);
  assert.deepEqual(analyzeSms(String.fromCodePoint(0x2801)).bySize["1"].symbols, [String.fromCodePoint(0x2801)]);
  // extension characters in English are group 2 with 2 septets each
  const x = analyzeSms("{}[]\\^~|€\f");
  assert.equal(x.bySize["2"].count, 10);
  assert.equal(x.bySize["2"].consumption, 20);
  assert.equal(x.length, 20);
});

test("segment boundaries: forward fill against the bit-level reference", () => {
  const failures = [];
  const check = (text, note) => {
    const r = analyzeSms(text);
    const ref = referenceSegments(text);
    if (!r.status.ok || r.isUnicode !== ref.isUnicode || r.length !== ref.length || JSON.stringify(r.segmentSizes) !== JSON.stringify(ref.segmentSizes) || r.segments !== ref.segmentSizes.length) {
      failures.push({ note, got: { u: r.isUnicode, len: r.length, segmentSizes: r.segmentSizes }, expected: ref });
    }
  };
  for (let n = 1; n <= 800; n++) { check("a".repeat(n), `${n} x a`); check("ক".repeat(n), `${n} x ক`); check("😀".repeat(Math.ceil(n / 2)), `${Math.ceil(n / 2)} x emoji`); }
  for (const total of [160, 161, 306, 307, 459, 460, 612]) {
    for (let k = 0; k <= total - 2; k++) check("A".repeat(k) + "€" + "A".repeat(total - 2 - k), `total ${total}, € after ${k}`);
  }
  for (const total of [70, 71, 134, 135, 201, 202, 268, 269]) {
    for (let k = 0; k <= total - 2; k++) check("ক".repeat(k) + "😀" + "ক".repeat(total - 2 - k), `total ${total}, emoji after ${k}`);
  }
  for (let k = 0; k <= 300; k++) check("A".repeat(k) + "€€" + "A".repeat(150), `two extension chars after ${k}`);
  assert.deepEqual(analyzeSms("A".repeat(152) + "€" + "A".repeat(152)).segmentSizes, [152, 153, 1]);
  assert.deepEqual(analyzeSms("ক".repeat(66) + "😀" + "ক".repeat(66)).segmentSizes, [66, 67, 1]);
  expectNoFailures(failures, "boundaries");
});

test("every vector agrees with the stored expected results and the bit-level reference", () => {
  const failures = [];
  const byGroup = {};
  for (const c of data.cases) {
    const r = analyzeSms(c.text);
    const ref = referenceSegments(c.text);
    const g = (byGroup[c.group] ??= { n: 0, bad: 0 });
    g.n++;
    const ok = r.status.ok && r.isUnicode === (c.type === "NON-ENGLISH") && r.length === c.length && r.segments === c.segments &&
      JSON.stringify(r.segmentSizes) === JSON.stringify(c.segmentSizes) && JSON.stringify(ref.segmentSizes) === JSON.stringify(c.segmentSizes);
    if (!ok) { g.bad++; failures.push({ group: c.group, note: c.note, text: show(c.text), expected: { type: c.type, length: c.length, segmentSizes: c.segmentSizes }, got: { unicode: r.isUnicode, length: r.length, segmentSizes: r.segmentSizes } }); }
  }
  console.log(Object.entries(byGroup).map(([k, g]) => `${k}: ${g.n - g.bad}/${g.n}`).join("\n"));
  expectNoFailures(failures, "vectors");
});

test("invariants on every vector: counts, consumption, symbols, length", () => {
  const failures = [];
  for (const c of data.cases) {
    const r = analyzeSms(c.text);
    const codePoints = [...c.text].length;
    const g1 = r.bySize["1"], g2 = r.bySize["2"];
    const problems = [];
    if (g1.count + g2.count !== codePoints) problems.push("counts do not add up to the number of characters");
    if (g1.consumption !== g1.count || g2.consumption !== g2.count * 2) problems.push("consumption is not size x count");
    if (g1.consumption + g2.consumption !== r.length) problems.push("consumptions do not add up to length");
    if (g1.symbols.length !== g1.count || g2.symbols.length !== g2.count) problems.push("symbols length differs from count");
    if (r.segmentSizes.reduce((a, b) => a + b, 0) !== r.length) problems.push("segment sizes do not add up to length");
    if (r.segments !== r.segmentSizes.length) problems.push("segments differs from segmentSizes length");
    const limit = r.isUnicode ? [70, 67] : [160, 153];
    if (r.segmentSizes.length === 1 ? r.segmentSizes[0] > limit[0] : r.segmentSizes.some((p) => p === 0 || p > limit[1])) problems.push("segment over capacity");
    if (r.isUnicode && c.text.length !== r.length) problems.push("Unicode length differs from the UTF-16 string length");
    if (problems.length) failures.push({ note: c.note, text: show(c.text), problems });
  }
  expectNoFailures(failures, "invariants");
});

test("realistic multilingual messages: language, size and segments", () => {
  const expectations = {
    "English OTP": [false, 1], "English delivery": [false, 1], "English promo": [false, 1], "English reminder": [false, 1], "English straight quote": [false, 1], "English with newline": [false, 1], "English extension chars": [false, 1],
    "English curly quote": [true, 1], "English with tab": [true, 1], "English with NBSP": [true, 1], "English with ZWSP": [true, 1],
    "English long, 3 segments": [false, 3], "Spanish (o-acute)": [true, 1], "Spanish (GSM only)": [false, 1],
    "French (e-acute only)": [false, 1], "French (e-circumflex)": [true, 1], "German (GSM only)": [false, 1],
    "Greek lowercase": [true, 1], "Greek capitals only": [false, 1], "Precomposed accent": [false, 1], "Combining accent": [true, 1],
    "Bangla long, 7 segments": [true, 7], "Emoji heavy long": [true, 3], "Emoji only": [true, 1],
  };
  const failures = [];
  for (const c of data.cases.filter((x) => x.group === "K_realistic_multilingual")) {
    const r = analyzeSms(c.text);
    const want = expectations[c.note] ?? [true, 1];
    if (r.isUnicode !== want[0] || r.segments !== want[1]) failures.push({ note: c.note, got: [r.isUnicode, r.segments], want });
  }
  expectNoFailures(failures, "realistic");
  // the 93-unit bill message that the old code reported as 1 segment
  const bill = analyzeSms("প্রিয় গ্রাহক, আপনার বিল পরিশোধ করার শেষ তারিখ ১৫ জানুয়ারি। অনুগ্রহ করে সময়মতো পরিশোধ করুন।");
  assert.equal(bill.isUnicode, true);
  assert.equal(bill.length, 93);
  assert.deepEqual(bill.segmentSizes, [67, 26]);
});

test("large input stays fast", () => {
  const t0 = process.hrtime.bigint();
  analyzeSms("a".repeat(100000));
  analyzeSms("ক".repeat(100000));
  analyzeSms("😀".repeat(50000));
  assert.ok(Number(process.hrtime.bigint() - t0) / 1e6 < 2000);
});
