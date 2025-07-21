const { Country, City } = require("../models");

exports.getCountries = async (req, res) => {
  try {
    const countries = await Country.findAll();
    res.json(countries);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des pays." });
  }
};

exports.getCities = async (req, res) => {
  try {
    const cities = await City.findAll({ include: [{ model: Country }] });
    res.json(cities);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des villes." });
  }
};

exports.getCitiesByCountry = async (req, res) => {
  const { countryId } = req.params;
  try {
    const cities = await City.findAll({ where: { pays_id: countryId } });
    res.json(cities);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des villes." });
  }
};
