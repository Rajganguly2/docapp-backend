const express = require("express");
const cors    = require("cors");
require("dotenv").config();

const { initDB } = require("./db");
const app = express();

app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://docapp-frontend-sandy.vercel.app/"    // replace with your actual Vercel URL
  ],
  credentials: true
}));

app.use(express.json());

// Routes
app.use("/api/auth",         require("./routes/auth"));
app.use("/api/doctors",      require("./routes/doctors"));
app.use("/api/appointments", require("./routes/appointments"));
app.use("/api/admin",        require("./routes/admin"));

app.get("/", (req, res) => res.json({ status: "ok", message: "DocApp API running" }));

// Init DB then start server
initDB()
  .then(() => {
    app.listen(process.env.PORT || 5000, () =>
      console.log(`🚀 Server running on port ${process.env.PORT || 5000}`)
    );
  })
  .catch(err => {
    console.error("❌ DB init failed:", err.message);
    process.exit(1);
  });