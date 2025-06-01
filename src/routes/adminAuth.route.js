const express = require("express");
const router = express.Router();
const adminAuth = require("../controllers/adminAuth.controller");

router.post("/login", adminAuth.login);

module.exports = router;
