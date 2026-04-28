const express = require("express");
const cors = require("cors"); 
const db = require("./config/db");
const requestLogger = require("./middlewares/requestLogger");
const authMiddleware = require("./middlewares/auth.middleware");

const app = express();

app.use(
  cors({
    origin: "http://localhost:8080",
    credentials: true,
  })
);

app.set("trust proxy", true);

app.use(express.json());
app.use(requestLogger);

app.get("/", (req, res) => {
  res.send("Talksy backend running");
});

app.get("/test-db", async (req, res) => {
  try {
    const { data, error } = await db.from("users").select("*");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/me", authMiddleware, async (req, res) => {
  res.json({
    message: "You are authenticated",
    user: req.user,
  });
});

const authRoutes = require("./modules/auth/auth.routes");
app.use("/auth", authRoutes);

module.exports = app;