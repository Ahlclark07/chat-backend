const express = require("express");
const router = express.Router();
const controller = require("../controllers/adminClient.controller");
const {
  authenticateAdminJWT,
  authorizeRole,
} = require("../middlewares/admin.middleware");

router.get(
  "/clients",
  authenticateAdminJWT,
  authorizeRole("god"),
  controller.listClients
);

router.get(
  "/clients/:id",
  authenticateAdminJWT,
  authorizeRole("god"),
  controller.getClientById
);

router.patch(
  "/clients/:id/status",
  authenticateAdminJWT,
  authorizeRole("god"),
  controller.updateBanStatus
);

module.exports = router;
