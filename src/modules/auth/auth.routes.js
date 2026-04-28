const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middlewares/auth.middleware");

const authController = require("./auth.controller");

router.post("/otp/request", authController.requestOtp);
router.post("/otp/verify", authController.verifyOtp);
router.post("/onboarding",  authController.saveOnboarding);

module.exports = router;