const db = require("../config/db");

const requestLogger = (req, res, next) => {
  try {

    if (req.originalUrl === "/test-db") return next();
    
    // Get IP safely
    let ip =
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      req.ip ||
      null;

    if (ip && ip.includes(",")) {
      ip = ip.split(",")[0].trim();
    }

    // Get user agent
    const userAgent = req.headers["user-agent"] || "";

    // Device detection
    let deviceType = "web";
    if (/android/i.test(userAgent)) deviceType = "android";
    else if (/iphone|ipad|ipod/i.test(userAgent)) deviceType = "ios";

    // Fire & forget (non-blocking)
    db
      .from("request_logs")
      .insert([
        {
          method: req.method,
          path: req.originalUrl,

          ip_address: ip,
          user_agent: userAgent,
          device_type: deviceType,

          country: null,
          region: null,
          city: null,
          timezone: null,
          isp: null,
          asn: null,
          is_proxy: false,
          is_tor: false,
          threat_score: 0,
        },
      ])
      .then(() => {})
      .catch((err) => {
        console.error("Log insert error:", err.message);
      });

  } catch (err) {
    console.error("Logger crash:", err.message);
  }

  next();
};

module.exports = requestLogger;