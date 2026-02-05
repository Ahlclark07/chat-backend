const express = require("express");
const router = express.Router();
const clientController = require("../controllers/client.controller");
const authController = require("../controllers/auth.controller");
const { authenticateJWT } = require("../middlewares/auth.middleware");
const { uploadClientPhoto } = require("../middlewares/upload.middleware"); // prêt à brancher si on ajoute l'upload

router.get("/girls", clientController.listGirls);
router.get("/girls/:id", clientController.getGirlById);
router.post(
  "/girls/:id/favorite",
  authenticateJWT,
  clientController.toggleFavorite
);
router.post(
  "/girls/:id/block",
  authenticateJWT,
  clientController.blockGirl
);
router.delete(
  "/girls/:id/block",
  authenticateJWT,
  clientController.unblockGirl
);
router.get("/filteredgirls", clientController.getFilteredGirls);
router.put(
  "/me",
  authenticateJWT,
  uploadClientPhoto,
  authController.updateProfile
);

router.get("/favorites/ids", authenticateJWT, clientController.getLikedGirlIds);
router.get("/blocks", authenticateJWT, clientController.listBlockedProfiles);

module.exports = router;
