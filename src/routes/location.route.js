const express = require("express");
const router = express.Router();
const controller = require("../controllers/location.controller");

router.get("/countries", controller.getCountries);
router.get("/cities", controller.getCities);
router.get("/cities/by-country/:countryId", controller.getCitiesByCountry);

module.exports = router;
