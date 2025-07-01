const fs = require("fs");
const pdfjsLib = require("pdfjs-dist");
const stringSimilarity = require("string-similarity");

const genericWords = [
  "enterprise",
  "enterprises",
  "handicrafts",
  "handicraft",
  "decor",
  "decorators",
  "exports",
  "events",
  "technology",
  "engineering",
  "steel",
  "plastics",
  "plast",
  "pvt",
  "ltd",
  "llp",
  "design",
  "tent",
  "furnishing",
  "impex",
  "group",
  "solution",
  "interior",
];

function isJunk(text) {
  return (
    !text ||
    text.length < 3 ||
    /^[A-Z]{1,3}\d{1,4}$/.test(text) ||
    /^\d{1,2}\s*[xX*]\s*\d{1,2}$/.test(text) ||
    /^\d+\s*(Sqm|SQM)$/i.test(text) ||
    /entry|exit|hall|wash|room|toilet|road map|demo|booked|emergency|ladies|gents|stairs|center|march|organized by/i.test(
      text
    )
  );
}

function isTooGeneric(name) {
  const words = name.toLowerCase().split(/\s+/);
  const matches = words.filter((w) => genericWords.includes(w));
  return matches.length >= words.length * 0.6 || words.length < 2;
}

function hasTwoDistinctWords(name) {
  const words = name.trim().toLowerCase().split(/\s+/);
  return new Set(words).size >= 2;
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z\s&]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isNearDuplicate(existing, candidate) {
  return existing.some(
    (e) => stringSimilarity.compareTwoStrings(e, candidate) > 0.85
  );
}

function adaptiveThreshold(items) {
  const ys = items.map((i) => i.transform[5]);
  const xs = items.map((i) => i.transform[4]);

  const avgY = Math.abs((Math.max(...ys) - Math.min(...ys)) / ys.length);
  const avgX = Math.abs((Math.max(...xs) - Math.min(...xs)) / xs.length);

  return {
    y: Math.max(6, Math.min(avgY * 1.3, 16)),
    x: Math.max(30, Math.min(avgX * 2.5, 100)),
  };
}

function clusterByProximity(items, thresholds) {
  const blocks = [];

  for (const item of items) {
    const text = item.str.trim();
    if (isJunk(text)) continue;

    const x = item.transform[4];
    const y = item.transform[5];

    let added = false;

    for (const block of blocks) {
      const match = block.items.some(
        (i) =>
          Math.abs(i.x - x) < thresholds.x && Math.abs(i.y - y) < thresholds.y
      );
      if (match) {
        block.items.push({ text, x, y });
        added = true;
        break;
      }
    }

    if (!added) {
      blocks.push({ items: [{ text, x, y }] });
    }
  }

  return blocks.map((block) => {
    const sorted = block.items.sort((a, b) =>
      b.y !== a.y ? b.y - a.y : a.x - b.x
    );
    return sorted
      .map((i) => i.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  });
}

function groupByLines(items) {
  const lines = {};
  items.forEach((item) => {
    const text = item.str.trim();
    if (isJunk(text)) return;

    const x = item.transform[4];
    const y = Math.round(item.transform[5]);

    if (!lines[y]) lines[y] = [];
    lines[y].push({ text, x });
  });

  return Object.values(lines).map((line) => {
    const sorted = line.sort((a, b) => a.x - b.x);
    return sorted
      .map((i) => i.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  });
}

async function extractCompanyNames(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  const items = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    items.push(...content.items);
  }

  const thresholds = adaptiveThreshold(items);
  let clustered = clusterByProximity(items, thresholds);

  if (clustered.length < 5 || clustered.length > 500) {
    console.warn("⚠️ Fallback to line join logic");
    clustered = groupByLines(items);
  }

  const final = [];
  const seenNormalized = new Set();

  for (let raw of clustered) {
    const cleaned = raw.replace(/\s+/g, " ").trim();
    if (!cleaned || cleaned.length < 4) continue;

    const pieces = cleaned
      .split(
        /\d+\s*(Sqm|sqm|SQM)?|\d{1,2}\s*[xX*]\s*\d{1,2}|[A-Z]{1,2}\d{1,3}/g
      )
      .filter((p) => typeof p === "string" && p.trim().length > 0)
      .map((p) => p.trim());

    for (const name of pieces) {
      if (name.length < 5 || isTooGeneric(name) || !hasTwoDistinctWords(name))
        continue;

      const norm = normalizeName(name);
      if (seenNormalized.has(norm) || isNearDuplicate(final, name)) continue;

      seenNormalized.add(norm);
      final.push(name);
    }
  }

  return final;
}

module.exports = extractCompanyNames;
