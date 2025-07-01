// services/scraper.js
const axios = require("axios");
const cheerio = require("cheerio");

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function scrapeCompanyContact(company) {
  const query = encodeURIComponent(`${company} contact`);
  const url = `https://html.duckduckgo.com/html/?q=${query}`;

  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const $ = cheerio.load(data);
    const firstResult = $(".result__snippet").first().text();

    const email =
      firstResult.match(/[a-zA-Z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] || "";
    const phone = firstResult.match(/(?:\+91[-\s]?|0)?[789]\d{9}/)?.[0] || "";
    const address = firstResult.length > 30 ? firstResult.slice(0, 100) : "";

    return { company, email, phone, address };
  } catch (err) {
    console.error("Scrape failed for:", company);
    return { company, email: "", phone: "", address: "" };
  }
}

async function scrapeMultiple(companies) {
  const results = [];
  for (const c of companies) {
    const info = await scrapeCompanyContact(c);
    results.push(info);
    await delay(1000); // 1 sec delay between requests
  }
  return results;
}

module.exports = { scrapeCompanyContact, scrapeMultiple };
