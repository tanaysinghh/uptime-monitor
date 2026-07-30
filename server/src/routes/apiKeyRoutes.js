const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { validate } = require("../middlewares/validate");
const { apiKeyValidator, uuidParam } = require("../middlewares/validators");
const { getApiKeys, createApiKey, revokeApiKey } = require("../controllers/apiKeyController");

router.use(authenticate);

router.get("/", getApiKeys);
router.post("/", apiKeyValidator, validate, createApiKey);
router.put("/:id/revoke", uuidParam(), validate, revokeApiKey);

module.exports = router;