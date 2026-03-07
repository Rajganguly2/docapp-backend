const router = require("express").Router();
const { pool } = require("../db");
const { auth, adminOnly } = require("../middleware/auth");

// ── Book appointment (patient) ─────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  try {
    const { doctor, date, time, reason, fee } = req.body;

    // Check slot clash
    const [clash] = await pool.query(
      "SELECT id FROM appointments WHERE doctor_id=? AND date=? AND time=? AND status IN ('pending','confirmed')",
      [doctor, date, time]
    );
    if (clash.length) return res.status(400).json({ message: "This time slot is already booked" });

    const [result] = await pool.query(
      "INSERT INTO appointments (patient_id, doctor_id, date, time, reason, fee) VALUES (?,?,?,?,?,?)",
      [req.user.id, doctor, date, time, reason||"", fee||0]
    );

    const [rows] = await pool.query(`
      SELECT a.*, 
        u.name AS patient_name, u.email AS patient_email, u.phone AS patient_phone,
        d.name AS doctor_name,  d.specialty, d.department, d.fee AS doctor_fee
      FROM appointments a
      JOIN users   u ON a.patient_id = u.id
      JOIN doctors d ON a.doctor_id  = d.id
      WHERE a.id = ?
    `, [result.insertId]);

    res.status(201).json(formatAppt(rows[0]));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Get my appointments (patient) ──────────────────────────────────────────────
router.get("/my", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.*,
        d.name AS doctor_name, d.specialty, d.department, d.fee AS doctor_fee
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.patient_id = ?
      ORDER BY a.date DESC, a.time DESC
    `, [req.user.id]);
    res.json(rows.map(formatAppt));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Cancel appointment (patient) ───────────────────────────────────────────────
router.put("/:id/cancel", auth, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM appointments WHERE id=? AND patient_id=?", [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ message: "Appointment not found" });
    await pool.query("UPDATE appointments SET status='cancelled' WHERE id=?", [req.params.id]);
    res.json({ message: "Cancelled" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Get booked slots for a doctor on a date (public) ──────────────────────────
router.get("/slots/:doctorId/:date", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT time FROM appointments WHERE doctor_id=? AND date=? AND status IN ('pending','confirmed')",
      [req.params.doctorId, req.params.date]
    );
    res.json(rows.map(r => r.time));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Get all appointments (admin) ───────────────────────────────────────────────
router.get("/", adminOnly, async (req, res) => {
  try {
    const { status, date } = req.query;
    let sql    = `
      SELECT a.*,
        u.name AS patient_name, u.email AS patient_email, u.phone AS patient_phone,
        d.name AS doctor_name,  d.specialty, d.department
      FROM appointments a
      JOIN users   u ON a.patient_id = u.id
      JOIN doctors d ON a.doctor_id  = d.id
      WHERE 1=1
    `;
    const vals = [];
    if (status) { sql += " AND a.status = ?"; vals.push(status); }
    if (date)   { sql += " AND a.date = ?";   vals.push(date); }
    sql += " ORDER BY a.created_at DESC";

    const [rows] = await pool.query(sql, vals);
    res.json(rows.map(formatAppt));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Update appointment status (admin) ─────────────────────────────────────────
router.put("/:id/status", adminOnly, async (req, res) => {
  try {
    await pool.query("UPDATE appointments SET status=? WHERE id=?", [req.body.status, req.params.id]);
    const [rows] = await pool.query(`
      SELECT a.*,
        u.name AS patient_name, u.email AS patient_email,
        d.name AS doctor_name,  d.specialty
      FROM appointments a
      JOIN users   u ON a.patient_id = u.id
      JOIN doctors d ON a.doctor_id  = d.id
      WHERE a.id = ?
    `, [req.params.id]);
    res.json(formatAppt(rows[0]));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Format helper — makes SQL rows look like the frontend expects
function formatAppt(row) {
  return {
    _id:    row.id,
    id:     row.id,
    date:   row.date,
    time:   row.time,
    reason: row.reason,
    status: row.status,
    fee:    row.fee,
    patient: { name: row.patient_name, email: row.patient_email, phone: row.patient_phone },
    doctor:  { name: row.doctor_name,  specialty: row.specialty, department: row.department, fee: row.doctor_fee },
  };
}

module.exports = router;