const router  = require("express").Router();
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const { pool } = require("../db");
const { auth } = require("../middleware/auth");

const makeToken = (user) => jwt.sign(
  { id: user.id, role: user.role, name: user.name },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

// ── Register ───────────────────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, dob, gender, address } = req.body;

    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length) return res.status(400).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password, phone, dob, gender, address) VALUES (?,?,?,?,?,?,?)",
      [name, email, hashed, phone||"", dob||"", gender||"", address||""]
    );

    const user = { id: result.insertId, name, email, role: "patient" };
    res.status(201).json({ token: makeToken(user), user });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Login ──────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (!rows.length) return res.status(400).json({ message: "Invalid email or password" });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid email or password" });

    const { password: _, ...safeUser } = user;
    res.json({ token: makeToken(safeUser), user: { id: safeUser.id, name: safeUser.name, email: safeUser.email, role: safeUser.role } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Get Profile ────────────────────────────────────────────────────────────────
router.get("/me", auth, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id,name,email,phone,dob,gender,address,role,created_at FROM users WHERE id = ?", [req.user.id]);
    if (!rows.length) return res.status(404).json({ message: "User not found" });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Update Profile ─────────────────────────────────────────────────────────────
router.put("/me", auth, async (req, res) => {
  try {
    const { name, phone, dob, gender, address } = req.body;
    await pool.query(
      "UPDATE users SET name=?, phone=?, dob=?, gender=?, address=? WHERE id=?",
      [name, phone||"", dob||"", gender||"", address||"", req.user.id]
    );
    const [rows] = await pool.query("SELECT id,name,email,phone,dob,gender,address,role FROM users WHERE id=?", [req.user.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;