const express = require("express");
const router = express.Router();
const controller = require("../controllers/credit.controller");
const { authenticateJWT } = require("../middlewares/auth.middleware");

// Achat de crédits (stub paiement pour l'instant)
router.post("/purchase", authenticateJWT, controller.purchaseCredits);

module.exports = router;

