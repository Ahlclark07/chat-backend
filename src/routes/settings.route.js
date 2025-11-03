const express = require("express");
const router = express.Router();
const controller = require("../controllers/settings.controller");
const { authenticateAdminJWT } = require("../middlewares/admin.middleware");

router.get("/settings", authenticateAdminJWT, controller.getSettings);
router.patch(
  "/settings/coin-cost",
  authenticateAdminJWT,
  controller.updateCoinCost
);
router.patch(
  "/settings/auto-messages",
  authenticateAdminJWT,
  controller.updateAutoMessages
);
router.get(
  "/settings/homepage-girls",
  authenticateAdminJWT,
  controller.getHomepageGirls
);
router.put(
  "/settings/homepage-girls",
  authenticateAdminJWT,
  controller.updateHomepageGirls
);

module.exports = router;
