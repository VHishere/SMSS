const express = require("express");

const paymentController = require("../controllers/payment.controller");

const router = express.Router();

// Public server-to-server webhook — ZaloPay calls this directly, no user auth.
router.post("/zalopay/callback", paymentController.zalopayCallback);

module.exports = router;
