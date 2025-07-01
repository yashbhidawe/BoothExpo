const axios = require("axios");
const cheerio = require("cheerio");
const validator = require("validator");

const LOCATION_FILTER =
  /Karnataka|Bangalore|Bengaluru|Mysore|Hubli|Belgaum|Mangalore|Pune|Mumbai/i;

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function extractEmail(text) {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return match && validator.isEmail(match[0]) ? match[0] : "";
}

function extractPhone(text) {
  const match = text.match(/(?:\+91[-\s]?|0)?[789]\d{9}/);
  return match && validator.isMobilePhone(match[0], "en-IN") ? match[0] : "";
}

function extractAddress(text) {
  const locationMatch = text.match(
    /(Bangalore|Bengaluru|Karnataka|Mysore|Hubli|Belgaum|Mangalore|Pune|Mumbai)[^.!]{0,100}/i
  );

  if (locationMatch) {
    return locationMatch[0].replace(/\s{2,}/g, " ").trim();
  }

  const fallback = text.match(/.{30,150}/);
  return fallback ? fallback[0].trim() : "";
}

async function scrapeCompanyContact(company) {
  const query = encodeURIComponent(`${company} contact Karnataka`);
  const url = `https://html.duckduckgo.com/html/?q=${query}`;

  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 10000,
    });

    const $ = cheerio.load(data);
    let snippet = $(".result__snippet").first().text().trim();

    // Fallback to second snippet if first is empty
    if (!snippet) {
      snippet = $(".result__snippet").eq(1).text().trim();
    }

    // Clean up snippet
    snippet = snippet
      .replace(/\n/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    const email = extractEmail(snippet);
    const phone = extractPhone(snippet);
    const address = extractAddress(snippet);

    return { company, email, phone, address };
  } catch (err) {
    console.error(`❌ Scrape failed for: ${company}`, err.message);
    return { company, email: "", phone: "", address: "" };
  }
}

async function scrapeMultiple(companies) {
  const results = [];

  for (const [i, company] of companies.entries()) {
    console.log(`🔍 [${i + 1}/${companies.length}] Scraping: ${company}`);
    const result = await scrapeCompanyContact(company);
    results.push(result);
    await delay(1200); // DuckDuckGo block prevention
  }

  return results;
}

module.exports = { scrapeCompanyContact, scrapeMultiple };
