const fs = require("fs");
const pdfjsLib = require("pdfjs-dist");

// junk patterns
function isJunk(text) {
  return (
    !text ||
    /^\d{3,4}$/.test(text) || // booth numbers
    /^\d{1,2}x\d{1,2}$/i.test(text) || // dimensions
    /entry|exit|hall|wash|room|toilet|food|stall|gate|booked|walk|way|open to sky/i.test(
      text
    ) ||
    text.length <= 2
  );
}

// group words into spatially close "blocks" — booth names
function groupIntoBlocks(items, yThreshold = 10, xThreshold = 60) {
  const blocks = [];

  for (const item of items) {
    const { str: text, transform } = item;
    const cleaned = text.trim();
    if (isJunk(cleaned)) continue;

    const x = transform[4];
    const y = transform[5];

    let placed = false;

    for (const block of blocks) {
      const close = block.items.some(
        (i) => Math.abs(i.y - y) < yThreshold && Math.abs(i.x - x) < xThreshold
      );
      if (close) {
        block.items.push({ text: cleaned, x, y });
        placed = true;
        break;
      }
    }

    if (!placed) {
      blocks.push({ items: [{ text: cleaned, x, y }] });
    }
  }

  // Merge sorted text in each block
  const merged = blocks.map((block) => {
    const sorted = block.items.sort((a, b) =>
      b.y !== a.y ? b.y - a.y : a.x - b.x
    );
    return sorted
      .map((i) => i.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  });

  // Deduplicate and remove trash
  const unique = [...new Set(merged)].filter(
    (name) =>
      name.length > 4 && !/^\d/.test(name) && /^[\w\s&.,'-]+$/.test(name)
  );

  return unique;
}

async function extractCompanyNames(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;

  const allItems = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    allItems.push(...content.items);
  }

  const grouped = groupIntoBlocks(allItems);
  return grouped;
}

module.exports = extractCompanyNames;
