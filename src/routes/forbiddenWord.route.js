const express = require("express");
const router = express.Router();
const controller = require("../controllers/forbiddenWord.controller");
const {
  authenticateAdminJWT,
  authorizeRole,
} = require("../middlewares/admin.middleware");

// Admin listing (any authenticated admin)
router.get("/forbidden-words", authenticateAdminJWT, controller.list);
router.get(
  "/forbidden-words/_debug",
  authenticateAdminJWT,
  authorizeRole("god"),
  controller.debug
);

// Create (only god)
router.post(
  "/forbidden-words",
  authenticateAdminJWT,
  authorizeRole("god"),
  controller.create
);

// Delete (only god)
router.delete(
  "/forbidden-words/:id",
  authenticateAdminJWT,
  authorizeRole("god"),
  controller.remove
);

module.exports = router;
