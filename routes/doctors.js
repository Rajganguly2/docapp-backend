const router = require("express").Router();
const { pool } = require("../db");
const { adminOnly } = require("../middleware/auth");

// Helper: get availability for doctor(s)
const getAvailability = async (doctorIds) => {
  if (!doctorIds.length) return {};
  const [rows] = await pool.query(
    `SELECT * FROM doctor_availability WHERE doctor_id IN (${doctorIds.map(()=>"?").join(",")})`,
    doctorIds
  );
  const map = {};
  rows.forEach(r => {
    if (!map[r.doctor_id]) map[r.doctor_id] = [];
    map[r.doctor_id].push({ day: r.day, times: r.times.split(",") });
  });
  return map;
};

// ── GET all doctors (public) ───────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { specialty, department, search } = req.query;
    let sql    = "SELECT * FROM doctors WHERE is_active = 1";
    const vals = [];
    if (specialty)  { sql += " AND specialty = ?";           vals.push(specialty); }
    if (department) { sql += " AND department = ?";          vals.push(department); }
    if (search)     { sql += " AND name LIKE ?";             vals.push(`%${search}%`); }

    const [doctors] = await pool.query(sql, vals);
    const avail     = await getAvailability(doctors.map(d => d.id));
    const result    = doctors.map(d => ({ ...d, availability: avail[d.id] || [] }));
    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── GET single doctor (public) ─────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM doctors WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Doctor not found" });
    const doctor = rows[0];
    const avail  = await getAvailability([doctor.id]);
    res.json({ ...doctor, availability: avail[doctor.id] || [] });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST create doctor (admin) ─────────────────────────────────────────────────
router.post("/", adminOnly, async (req, res) => {
  try {
    const { name, specialty, department, qualification, experience, fee, phone, email, bio, rating, availability } = req.body;
    const [result] = await pool.query(
      "INSERT INTO doctors (name,specialty,department,qualification,experience,fee,phone,email,bio,rating) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [name, specialty, department, qualification||"", experience||0, fee||500, phone||"", email||"", bio||"", rating||4.5]
    );
    const doctorId = result.insertId;

    // Insert availability
    if (availability?.length) {
      for (const slot of availability) {
        await pool.query(
          "INSERT INTO doctor_availability (doctor_id, day, times) VALUES (?,?,?)",
          [doctorId, slot.day, Array.isArray(slot.times) ? slot.times.join(",") : slot.times]
        );
      }
    }

    const [rows] = await pool.query("SELECT * FROM doctors WHERE id = ?", [doctorId]);
    const avail  = await getAvailability([doctorId]);
    res.status(201).json({ ...rows[0], availability: avail[doctorId] || [] });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── PUT update doctor (admin) ──────────────────────────────────────────────────
router.put("/:id", adminOnly, async (req, res) => {
  try {
    const { name, specialty, department, qualification, experience, fee, phone, email, bio, rating, availability } = req.body;
    await pool.query(
      "UPDATE doctors SET name=?,specialty=?,department=?,qualification=?,experience=?,fee=?,phone=?,email=?,bio=?,rating=? WHERE id=?",
      [name, specialty, department, qualification||"", experience||0, fee||500, phone||"", email||"", bio||"", rating||4.5, req.params.id]
    );

    // Update availability
    if (availability) {
      await pool.query("DELETE FROM doctor_availability WHERE doctor_id = ?", [req.params.id]);
      for (const slot of availability) {
        await pool.query(
          "INSERT INTO doctor_availability (doctor_id, day, times) VALUES (?,?,?)",
          [req.params.id, slot.day, Array.isArray(slot.times) ? slot.times.join(",") : slot.times]
        );
      }
    }

    const [rows] = await pool.query("SELECT * FROM doctors WHERE id = ?", [req.params.id]);
    const avail  = await getAvailability([Number(req.params.id)]);
    res.json({ ...rows[0], availability: avail[req.params.id] || [] });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── DELETE doctor (admin) ──────────────────────────────────────────────────────
router.delete("/:id", adminOnly, async (req, res) => {
  try {
    await pool.query("DELETE FROM doctors WHERE id = ?", [req.params.id]);
    res.json({ message: "Doctor deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;