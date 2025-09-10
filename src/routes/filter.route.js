const express = require("express");
const router = express.Router();
const controller = require("../controllers/forbiddenWord.controller");

// Public endpoint to retrieve forbidden words
router.get("/words", controller.getPublicWords);

module.exports = router;

