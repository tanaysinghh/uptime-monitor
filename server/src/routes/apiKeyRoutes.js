const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { getApiKeys, createApiKey, revokeApiKey } = require("../controllers/apiKeyController");

router.use(authenticate);

router.get("/", getApiKeys);
router.post("/", createApiKey);
router.put("/:id/revoke", revokeApiKey);

module.exports = router;