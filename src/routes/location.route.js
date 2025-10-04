const express = require("express");
const router = express.Router();
const controller = require("../controllers/location.controller");
const { authenticateAdminJWT, authorizeRole } = require("../middlewares/admin.middleware");

router.get("/countries", controller.getCountries);
router.post(
  "/countries",
  authenticateAdminJWT,
  authorizeRole("superadmin", "god"),
  controller.createCountry
);
router.patch(
  "/countries/:id",
  authenticateAdminJWT,
  authorizeRole("superadmin", "god"),
  controller.updateCountry
);
router.delete(
  "/countries/:id",
  authenticateAdminJWT,
  authorizeRole("superadmin", "god"),
  controller.deleteCountry
);

router.get("/cities", controller.getCities);
router.get("/cities/by-country/:countryId", controller.getCitiesByCountry);
router.post(
  "/cities",
  authenticateAdminJWT,
  authorizeRole("superadmin", "god"),
  controller.createCity
);
router.patch(
  "/cities/:id",
  authenticateAdminJWT,
  authorizeRole("superadmin", "god"),
  controller.updateCity
);
router.delete(
  "/cities/:id",
  authenticateAdminJWT,
  authorizeRole("superadmin", "god"),
  controller.deleteCity
);

module.exports = router;
