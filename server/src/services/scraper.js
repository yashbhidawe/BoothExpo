const axios = require("axios");
const cheerio = require("cheerio");
const validator = require("validator");

const LOCATION_FILTER =
  /Karnataka|Bangalore|Bengaluru|Mysore|Hubli|Belgaum|Mangalore|Pune|Mumbai/i;

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
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
    });

    const $ = cheerio.load(data);
    const snippet = $(".result__snippet").first().text().trim();

    const emailMatch = snippet.match(
      /[a-zA-Z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i
    );
    const email =
      emailMatch && validator.isEmail(emailMatch[0]) ? emailMatch[0] : "";

    const phoneMatch = snippet.match(/(?:\+91[-\s]?|0)?[789]\d{9}/);
    const phone =
      phoneMatch && validator.isMobilePhone(phoneMatch[0], "en-IN")
        ? phoneMatch[0]
        : "";

    const address =
      LOCATION_FILTER.test(snippet) && snippet.length > 30
        ? snippet.slice(0, 120)
        : "";

    if (!email && !phone && !address) {
      return { company, email: "", phone: "", address: "" };
    }

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
    await delay(1000);
  }

  return results;
}

module.exports = { scrapeCompanyContact, scrapeMultiple };
