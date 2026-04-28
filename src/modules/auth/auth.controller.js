const authService = require("./auth.service");

const SAFE_ERRORS = [
  "Invalid phone number",
  "Too many OTP requests. Try again later.",
];

const requestOtp = async (req, res) => {
  try {
    // ✅ body validation
    if (!req.body || !req.body.phone) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    let ip =
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      req.ip ||
      null;

    if (ip && ip.includes(",")) {
      ip = ip.split(",")[0].trim();
    }

    // ✅ normalize IPv6 format
    if (ip && ip.startsWith("::ffff:")) {
      ip = ip.replace("::ffff:", "");
    }

    const result = await authService.requestOtp({
      phone: req.body.phone,
      ip,
    });

    res.json(result);
  } catch (err) {
    console.error("❌ requestOtp error:", err);

    const message = SAFE_ERRORS.includes(err.message)
      ? err.message
      : "Something went wrong";

    res.status(400).json({ error: message });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const result = await authService.verifyOtp({
      phone: req.body.phone,
      code: req.body.code,
    });

    res.json(result);
  } catch (err) {
    console.error("❌ verifyOtp error:", err);

    const msg = (err.message || "").toLowerCase();

    let message = "Something went wrong";

    if (
      msg.includes("invalid phone") ||
      msg.includes("invalid otp") ||
      msg.includes("incorrect otp") ||
      msg.includes("expired") ||
      msg.includes("too many") ||
      msg.includes("already used")
    ) {
      message = err.message;
    }

    res.status(400).json({ error: message });
  }
};

const saveOnboarding = async (req, res) => {
  try {
    const userId = req.user.userId ; 

    const result = await authService.saveOnboarding({
      userId,
      payload: req.body,
    });

    res.json(result);
  } catch (err) {
    console.error("❌ onboarding error:", err);

    res.status(400).json({
      error: "Failed to save onboarding",
    });
  }
};

module.exports = {
  requestOtp,
  verifyOtp,
  saveOnboarding
};
