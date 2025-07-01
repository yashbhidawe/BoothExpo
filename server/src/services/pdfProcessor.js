const fs = require("fs");
const pdfjsLib = require("pdfjs-dist");

function isJunk(text) {
  return (
    !text ||
    text.length < 3 ||
    /^\d{3,4}$/.test(text) || // booth numbers
    /^\d{1,2}x\d{1,2}(\.\d+)?$/i.test(text) || // booth sizes
    /^[A-Z]{3,4}\d{1,3}[A-Z]?$/.test(text) || // stall IDs like 123A, A21B
    /entry|exit|hall|wash|toilet|open to sky|gate|food|booked|path|aisle|walk/i.test(
      text
    )
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

  const joined = blocks.map((block) => {
    const sorted = block.items.sort((a, b) =>
      b.y !== a.y ? b.y - a.y : a.x - b.x
    );
    return sorted
      .map((i) => i.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  });

  return joined;
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

  const merged = Object.values(lines).map((line) => {
    const sorted = line.sort((a, b) => a.x - b.x);
    return sorted
      .map((i) => i.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  });

  return merged;
}

function filterNames(lines) {
  const keywords =
    /Inc\.|Ltd|LLP|Corporation|Tech|Botanicals?|Handicrafts?|Furnishing|Decor|Steel|Plastics?|Events?|Overseas|Exports?|Foods?|Pharma|Group|Pvt|Enterprise/i;
  return [
    ...new Set(
      lines.map((l) => l.trim()).filter((l) => l.length > 5 && keywords.test(l))
    ),
  ];
}

async function extractCompanyNames(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  const items = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    items.push(...content.items);
  }

  // --- Try smart clustered extraction
  const threshold = adaptiveThreshold(items);
  const clustered = clusterByProximity(items, threshold);
  const cleanedClustered = filterNames(clustered);

  if (cleanedClustered.length >= 5 && cleanedClustered.length <= 150) {
    return cleanedClustered;
  }

  // --- fallback to raw line joining (like test2)
  console.warn("⚠️ Fallback to line joining due to bad clustering");
  const lineJoined = groupByLines(items);
  const fallbackCleaned = filterNames(lineJoined);
  return fallbackCleaned;
}

module.exports = extractCompanyNames;
