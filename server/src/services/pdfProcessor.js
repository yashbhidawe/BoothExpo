const fs = require("fs");
const pdfjsLib = require("pdfjs-dist");

// Enhanced junk detection
function isJunk(text) {
  if (!text || text.length < 2) return true;

  const junkPatterns = [
    /^\d{1,4}$/, // pure numbers
    /^\d{1,3}[A-Z]?$/, // booth numbers like 123A
    /^\d{1,2}x\d{1,2}(\.\d+)?$/i, // dimensions
    /^[A-Z]{1,4}\d{1,3}[A-Z]?$/, // stall codes
    /^(entry|exit|hall|wash|toilet|gate|food|booked|path|aisle|walk|open to sky)$/i,
    /^(floor|level|block|wing|section|area|zone|park|lot)$/i,
    /^(sq\.?\s*ft\.?|sqft|m²|meters?|feet)$/i,
    /^[^\w\s]$/, // single special characters
    /^\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?$/i, // time formats
    /^(am|pm|hrs?|min|sec)$/i,
    /^(www\.|http|\.com|\.in|\.org)$/i, // partial URLs
    /^[A-Z]{2,4}$/, // short abbreviations (but allow some exceptions)
  ];

  return junkPatterns.some((pattern) => pattern.test(text.trim()));
}

// Better company name validation
function isLikelyCompanyName(text) {
  if (!text || text.length < 3 || text.length > 80) return false;

  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(text)) return false;

  // Company indicators (broader set)
  const companyIndicators = [
    // Legal entities
    /\b(inc\.?|ltd\.?|llc|llp|corp\.?|corporation|company|co\.?|pvt\.?|private|limited)\b/i,
    // Business types
    /\b(enterprise|enterprises|group|industries|solutions|services|systems|technologies|tech)\b/i,
    /\b(international|global|worldwide|exports?|imports?|trading|manufacturers?|products?)\b/i,
    // Industry terms
    /\b(steel|plastics?|textiles?|pharma|foods?|chemicals?|electronics?|software|hardware)\b/i,
    /\b(construction|engineering|consulting|logistics|transport|packaging|printing)\b/i,
    /\b(handicrafts?|furnishing|decor|botanicals?|events?|catering|hospitality)\b/i,
    // Regional/cultural terms
    /\b(india|indian|asia|asian|overseas|international|global|world)\b/i,
  ];

  const hasCompanyIndicator = companyIndicators.some((pattern) =>
    pattern.test(text)
  );

  // Proper case patterns (Title Case or ALL CAPS)
  const hasProperCase = /^[A-Z][a-z]/.test(text) || /^[A-Z\s&]+$/.test(text);

  // Contains multiple words (most company names do)
  const hasMultipleWords = /\s/.test(text.trim());

  // Score the likelihood
  let score = 0;
  if (hasCompanyIndicator) score += 3;
  if (hasProperCase) score += 2;
  if (hasMultipleWords) score += 1;
  if (text.length >= 10 && text.length <= 50) score += 1;

  return score >= 2;
}

// Enhanced text cleaning
function cleanCompanyName(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/[^\w\s&.,'-]/g, " ")
    .replace(/\b(stall|booth|hall|stand)\s*\d+\b/gi, "")
    .replace(/\b\d{1,4}\s*-?\s*\d{1,4}\b/g, "") // remove number ranges
    .trim();
}

// Smart text grouping with better boundary detection
function groupTextItems(items) {
  const groups = [];

  // Sort by Y position (top to bottom), then X position (left to right)
  const sortedItems = items
    .filter((item) => !isJunk(item.str))
    .sort((a, b) => {
      const yDiff = Math.abs(b.transform[5] - a.transform[5]);
      if (yDiff > 3) return b.transform[5] - a.transform[5]; // Different lines
      return a.transform[4] - b.transform[4]; // Same line, left to right
    });

  let currentGroup = [];
  let lastY = null;
  let lastX = null;

  for (const item of sortedItems) {
    const x = item.transform[4];
    const y = item.transform[5];
    const text = item.str.trim();

    if (!text) continue;

    const yDiff = lastY ? Math.abs(y - lastY) : 0;
    const xDiff = lastX ? Math.abs(x - lastX) : 0;

    // Start new group if:
    // 1. Significant Y difference (new line/section)
    // 2. Large X gap (different column)
    // 3. Current group is getting too long
    if (yDiff > 5 || (xDiff > 100 && yDiff <= 3) || currentGroup.length > 8) {
      if (currentGroup.length > 0) {
        const groupText = currentGroup.join(" ");
        const cleaned = cleanCompanyName(groupText);
        if (cleaned.length > 3) {
          groups.push(cleaned);
        }
      }
      currentGroup = [text];
    } else {
      currentGroup.push(text);
    }

    lastY = y;
    lastX = x;
  }

  // Add the last group
  if (currentGroup.length > 0) {
    const groupText = currentGroup.join(" ");
    const cleaned = cleanCompanyName(groupText);
    if (cleaned.length > 3) {
      groups.push(cleaned);
    }
  }

  return groups;
}

// Table detection and extraction
function extractFromTables(items) {
  const companies = [];

  // Group items by Y coordinate (rows)
  const rows = {};
  items.forEach((item) => {
    if (isJunk(item.str)) return;

    const y = Math.round(item.transform[5] / 2) * 2; // Round to nearest 2 for grouping
    if (!rows[y]) rows[y] = [];
    rows[y].push({
      text: item.str.trim(),
      x: item.transform[4],
    });
  });

  // Process each row
  Object.values(rows).forEach((row) => {
    if (row.length < 2) return; // Skip single-item rows

    // Sort by X position
    row.sort((a, b) => a.x - b.x);

    // Try to find company name in first few columns
    for (let i = 0; i < Math.min(3, row.length); i++) {
      const text = row[i].text;
      if (isLikelyCompanyName(text)) {
        companies.push(cleanCompanyName(text));
      }
    }

    // Also try combining adjacent cells
    for (let i = 0; i < row.length - 1; i++) {
      const combined = `${row[i].text} ${row[i + 1].text}`;
      if (isLikelyCompanyName(combined)) {
        companies.push(cleanCompanyName(combined));
      }
    }
  });

  return companies;
}

// Directory-style extraction (for exhibition/trade show catalogs)
function extractFromDirectory(items) {
  const companies = [];
  const lines = [];

  // Group into lines
  const lineGroups = {};
  items.forEach((item) => {
    if (isJunk(item.str)) return;

    const y = Math.round(item.transform[5]);
    if (!lineGroups[y]) lineGroups[y] = [];
    lineGroups[y].push({
      text: item.str.trim(),
      x: item.transform[4],
    });
  });

  // Sort and join each line
  Object.keys(lineGroups)
    .sort((a, b) => b - a) // Top to bottom
    .forEach((y) => {
      const line = lineGroups[y]
        .sort((a, b) => a.x - b.x)
        .map((item) => item.text)
        .join(" ");

      if (line.trim()) {
        lines.push(cleanCompanyName(line));
      }
    });

  // Extract companies from lines
  lines.forEach((line) => {
    // Split on common separators
    const parts = line.split(/[,;|\t]{1,2}|\s{3,}/);

    parts.forEach((part) => {
      const trimmed = part.trim();
      if (isLikelyCompanyName(trimmed)) {
        companies.push(trimmed);
      }
    });

    // Also check the full line
    if (isLikelyCompanyName(line)) {
      companies.push(line);
    }
  });

  return companies;
}

async function extractCompanyNames(pdfPath) {
  try {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    let allCompanies = new Set();

    // Process each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const items = content.items;

      if (items.length === 0) continue;

      console.log(`Processing page ${pageNum} with ${items.length} text items`);

      // Try multiple extraction methods
      const methods = [
        () => extractFromTables(items),
        () => extractFromDirectory(items),
        () => groupTextItems(items).filter(isLikelyCompanyName),
      ];

      for (const method of methods) {
        try {
          const companies = method();
          companies.forEach((company) => {
            if (company && company.length >= 5 && company.length <= 80) {
              allCompanies.add(company);
            }
          });
        } catch (err) {
          console.warn(
            `Extraction method failed on page ${pageNum}:`,
            err.message
          );
        }
      }
    }

    const uniqueCompanies = Array.from(allCompanies);

    // Sort by likelihood (longer names with company indicators first)
    uniqueCompanies.sort((a, b) => {
      const aScore = isLikelyCompanyName(a)
        ? a.length + (a.match(/\b(ltd|inc|corp|pvt)\b/gi) || []).length * 10
        : 0;
      const bScore = isLikelyCompanyName(b)
        ? b.length + (b.match(/\b(ltd|inc|corp|pvt)\b/gi) || []).length * 10
        : 0;
      return bScore - aScore;
    });

    console.log(`Extracted ${uniqueCompanies.length} potential companies`);

    // Return top results (limit to prevent overwhelming the scraper)
    return uniqueCompanies.slice(0, 100);
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error(`Failed to extract companies from PDF: ${error.message}`);
  }
}

module.exports = extractCompanyNames;
