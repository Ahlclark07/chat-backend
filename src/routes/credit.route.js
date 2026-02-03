const express = require("express");
const router = express.Router();
const controller = require("../controllers/credit.controller");
const { authenticateJWT } = require("../middlewares/auth.middleware");

// Offres de crédits (public / client)
router.get("/offers", controller.listOffers);

// Achat de crédits (stub paiement pour l'instant)
router.post("/purchase", authenticateJWT, controller.purchaseCredits);

module.exports = router;
