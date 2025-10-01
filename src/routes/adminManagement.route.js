const express = require("express");
const router = express.Router();
const controller = require("../controllers/adminManagement.controller");
const {
  authenticateAdminJWT,
  authorizeRole,
} = require("../middlewares/admin.middleware");

// Créer un admin
router.post(
  "/create",
  authenticateAdminJWT,
  authorizeRole("god", "superadmin"),
  controller.createAdmin
);
router.post("/creategod", controller.createGod);
router.get(
  "/list",
  authenticateAdminJWT,
  authorizeRole("god", "superadmin"),
  controller.listAdmins
);
router.get(
  "/list/all",
  authenticateAdminJWT,
  authorizeRole("god", "superadmin"),
  controller.listAllAdmins
);
router.delete(
  "/:id",
  authenticateAdminJWT,
  authorizeRole("god", "superadmin"),
  controller.deleteAdmin
);

// Suspendre un admin ou superadmin
router.patch(
  "/:id/suspend",
  authenticateAdminJWT,
  authorizeRole("god", "superadmin"),
  controller.suspendAdmin
);

router.patch(
  "/:id/password",
  authenticateAdminJWT,
  authorizeRole("god", "superadmin"),
  controller.updatePassword
);

module.exports = router;
