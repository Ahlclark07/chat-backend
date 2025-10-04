const { Country, City, Girl } = require("../../models");

const normalizeString = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const parseOptionalInt = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

exports.getCountries = async (req, res) => {
  try {
    const countries = await Country.findAll({ order: [["name", "ASC"]] });
    res.json(countries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de la récupération des pays." });
  }
};

exports.getCities = async (req, res) => {
  try {
    const cities = await City.findAll({
      include: [{ model: Country, as: "country", attributes: ["id", "name", "code"] }],
      order: [["name", "ASC"]],
    });
    res.json(cities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de la récupération des villes." });
  }
};

exports.getCitiesByCountry = async (req, res) => {
  const { countryId } = req.params;
  try {
    const cities = await City.findAll({
      where: { country_id: countryId },
      order: [["name", "ASC"]],
    });
    res.json(cities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de la récupération des villes." });
  }
};

exports.createCountry = async (req, res) => {
  try {
    const name = normalizeString(req.body.name);
    if (!name) {
      return res.status(400).json({ message: "Le nom du pays est requis." });
    }

    const code = normalizeString(req.body.code);
    const payload = { name, code: code ? code.toUpperCase().slice(0, 2) : null };

    const country = await Country.create(payload);
    res.status(201).json(country);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de la création du pays." });
  }
};

exports.updateCountry = async (req, res) => {
  try {
    const countryId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(countryId)) {
      return res.status(400).json({ message: "Identifiant invalide." });
    }

    const country = await Country.findByPk(countryId);
    if (!country) {
      return res.status(404).json({ message: "Pays introuvable." });
    }

    if ("name" in req.body) {
      const name = normalizeString(req.body.name);
      if (!name) {
        return res.status(400).json({ message: "Le nom ne peut pas être vide." });
      }
      country.name = name;
    }

    if ("code" in req.body) {
      const code = normalizeString(req.body.code);
      country.code = code ? code.toUpperCase().slice(0, 2) : null;
    }

    await country.save();
    res.json(country);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de la mise à jour du pays." });
  }
};

exports.deleteCountry = async (req, res) => {
  try {
    const countryId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(countryId)) {
      return res.status(400).json({ message: "Identifiant invalide." });
    }

    const country = await Country.findByPk(countryId);
    if (!country) {
      return res.status(404).json({ message: "Pays introuvable." });
    }

    const linkedCities = await City.count({ where: { country_id: countryId } });
    const linkedGirls = await Girl.count({ where: { pays_id: countryId } });
    if (linkedCities > 0 || linkedGirls > 0) {
      return res.status(400).json({
        message: "Impossible de supprimer ce pays car des villes ou profils y sont rattachés.",
      });
    }

    await country.destroy();
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de la suppression du pays." });
  }
};

exports.createCity = async (req, res) => {
  try {
    const name = normalizeString(req.body.name);
    if (!name) {
      return res.status(400).json({ message: "Le nom de la ville est requis." });
    }

    const countryId = parseOptionalInt(req.body.country_id);
    if (!Number.isInteger(countryId)) {
      return res.status(400).json({ message: "country_id requis." });
    }

    const country = await Country.findByPk(countryId);
    if (!country) {
      return res.status(400).json({ message: "Pays introuvable." });
    }

    const city = await City.create({ name, country_id: countryId });
    const withCountry = await City.findByPk(city.id, {
      include: [{ model: Country, as: "country", attributes: ["id", "name", "code"] }],
    });
    res.status(201).json(withCountry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de la création de la ville." });
  }
};

exports.updateCity = async (req, res) => {
  try {
    const cityId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(cityId)) {
      return res.status(400).json({ message: "Identifiant invalide." });
    }

    const city = await City.findByPk(cityId);
    if (!city) {
      return res.status(404).json({ message: "Ville introuvable." });
    }

    if ("name" in req.body) {
      const name = normalizeString(req.body.name);
      if (!name) {
        return res.status(400).json({ message: "Le nom ne peut pas être vide." });
      }
      city.name = name;
    }

    if ("country_id" in req.body) {
      const countryId = parseOptionalInt(req.body.country_id);
      if (!Number.isInteger(countryId)) {
        return res.status(400).json({ message: "country_id invalide." });
      }
      const country = await Country.findByPk(countryId);
      if (!country) {
        return res.status(400).json({ message: "Pays introuvable." });
      }
      city.country_id = countryId;
    }

    await city.save();
    const withCountry = await City.findByPk(city.id, {
      include: [{ model: Country, as: "country", attributes: ["id", "name", "code"] }],
    });
    res.json(withCountry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de la mise à jour de la ville." });
  }
};

exports.deleteCity = async (req, res) => {
  try {
    const cityId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(cityId)) {
      return res.status(400).json({ message: "Identifiant invalide." });
    }

    const city = await City.findByPk(cityId);
    if (!city) {
      return res.status(404).json({ message: "Ville introuvable." });
    }

    const linkedGirls = await Girl.count({ where: { ville_id: cityId } });
    if (linkedGirls > 0) {
      return res.status(400).json({
        message: "Impossible de supprimer cette ville car des profils y sont rattachés.",
      });
    }

    await city.destroy();
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de la suppression de la ville." });
  }
};


