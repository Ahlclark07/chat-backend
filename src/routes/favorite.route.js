const express = require("express");
const router = express.Router();
const favoriteController = require("../controllers/favorite.controller");
const { authenticateJWT } = require("../middlewares/auth.middleware");

router.post("/:girl_id", authenticateJWT, favoriteController.toggleFavorite);
router.get("/", authenticateJWT, favoriteController.getFavorites);

module.exports = router;
