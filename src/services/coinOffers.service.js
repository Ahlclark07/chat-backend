const { Setting } = require("../../models");

const COIN_OFFERS_KEY = "coin_offers";

const DEFAULT_COIN_OFFERS = [
  {
    id: "starter",
    coins: 20,
    price: 18,
    original_price: 20,
    best_offer: false,
  },
  {
    id: "plus",
    coins: 60,
    price: 48,
    original_price: 60,
    best_offer: true,
  },
  {
    id: "max",
    coins: 150,
    price: 97.5,
    original_price: 150,
    best_offer: false,
  },
];

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "1", "yes", "on"].includes(normalized);
  }
  return false;
}

function normalizeOffer(raw, index, strict) {
  if (!raw || typeof raw !== "object") {
    if (strict) throw new Error("Offre invalide.");
    return null;
  }

  const coins = parseInt(raw.coins, 10);
  const price = parseFloat(raw.price);
  const originalRaw =
    raw.original_price ??
    raw.fake_price ??
    raw.original ??
    raw.fakePrice ??
    null;
  const originalPrice =
    originalRaw === null || typeof originalRaw === "undefined"
      ? null
      : parseFloat(originalRaw);

  if (!Number.isFinite(coins) || coins <= 0) {
    if (strict) throw new Error("Nombre de coins invalide.");
    return null;
  }
  if (!Number.isFinite(price) || price <= 0) {
    if (strict) throw new Error("Prix réel invalide.");
    return null;
  }

  let normalizedOriginal =
    Number.isFinite(originalPrice) && originalPrice > 0
      ? originalPrice
      : null;
  if (normalizedOriginal !== null && normalizedOriginal < price) {
    normalizedOriginal = null;
  }

  const bestOffer = parseBoolean(
    raw.best_offer ?? raw.bestOffer ?? raw.is_best ?? raw.highlight
  );

  const idValue =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : typeof raw.id === "number"
        ? String(raw.id)
        : null;

  const id = idValue || `offer_${Date.now()}_${index}`;

  return {
    id,
    coins,
    price,
    original_price: normalizedOriginal,
    best_offer: bestOffer,
  };
}

function normalizeCoinOffers(input, { strict = true } = {}) {
  let raw = input;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch (err) {
      if (strict) throw new Error("Format d'offres invalide.");
      return [];
    }
  }
  if (!Array.isArray(raw)) {
    if (strict) throw new Error("Les offres doivent être un tableau.");
    return [];
  }

  const offers = raw
    .map((item, index) => normalizeOffer(item, index, strict))
    .filter(Boolean);

  if (strict && offers.length === 0) {
    throw new Error("Aucune offre valide fournie.");
  }

  const bestOffers = offers.filter((o) => o.best_offer);
  if (bestOffers.length > 1) {
    throw new Error("Une seule offre peut être la meilleure offre.");
  }

  const seen = new Set();
  for (const offer of offers) {
    if (seen.has(offer.id)) {
      offer.id = `${offer.id}_${Date.now()}`;
    }
    seen.add(offer.id);
  }

  return offers.sort((a, b) => a.coins - b.coins);
}

async function getCoinOffers() {
  try {
    const setting = await Setting.findOne({ where: { key: COIN_OFFERS_KEY } });
    if (!setting) return DEFAULT_COIN_OFFERS;
    const normalized = normalizeCoinOffers(setting.value, { strict: false });
    return normalized.length ? normalized : DEFAULT_COIN_OFFERS;
  } catch (err) {
    console.error("Erreur chargement offres coins:", err?.message || err);
    return DEFAULT_COIN_OFFERS;
  }
}

async function saveCoinOffers(rawOffers) {
  const offers = normalizeCoinOffers(rawOffers, { strict: true });
  const value = JSON.stringify(offers);
  const [setting, created] = await Setting.findOrCreate({
    where: { key: COIN_OFFERS_KEY },
    defaults: { value },
  });
  if (!created) {
    await setting.update({ value });
  }
  return offers;
}

module.exports = {
  getCoinOffers,
  saveCoinOffers,
  normalizeCoinOffers,
  DEFAULT_COIN_OFFERS,
};
