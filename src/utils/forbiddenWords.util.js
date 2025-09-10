const { ForbiddenWord } = require("../../models");

// Fetches all forbidden words and returns matches in the given text
async function findForbiddenWordsIn(text = "") {
  const cleanText = String(text).toLowerCase();
  if (!cleanText.trim()) return [];

  const rows = await ForbiddenWord.findAll({ attributes: ["word"] });
  const words = rows.map((r) => String(r.word || "").trim()).filter(Boolean);
  if (words.length === 0) return [];

  const matches = [];
  for (const w of words) {
    // simple includes, case-insensitive; can be improved to word boundaries if needed
    if (cleanText.includes(w.toLowerCase())) {
      matches.push(w);
    }
  }
  return matches;
}

module.exports = { findForbiddenWordsIn };

