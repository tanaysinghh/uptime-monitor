const express = require("express");
const router = express.Router();
const { getPublicStatus } = require("../controllers/publicController");

router.get("/status/:slug", getPublicStatus);

module.exports = router;