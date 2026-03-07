const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT || 3306,       // Aiven uses a custom port
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: { rejectUnauthorized: false },           // Required for Aiven SSL
});

const initDB = async () => {
  const conn = await pool.getConnection();
  try {
    await conn.query(`USE \`${process.env.DB_NAME}\``);

    // Users table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(100) NOT NULL,
        email      VARCHAR(100) NOT NULL UNIQUE,
        password   VARCHAR(255) NOT NULL,
        phone      VARCHAR(20)  DEFAULT '',
        dob        VARCHAR(20)  DEFAULT '',
        gender     VARCHAR(20)  DEFAULT '',
        address    VARCHAR(200) DEFAULT '',
        role       ENUM('patient','admin') DEFAULT 'patient',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Doctors table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS doctors (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        name          VARCHAR(100) NOT NULL,
        specialty     VARCHAR(100) NOT NULL,
        department    VARCHAR(100) NOT NULL,
        qualification VARCHAR(200) DEFAULT '',
        experience    INT          DEFAULT 0,
        fee           INT          DEFAULT 500,
        phone         VARCHAR(20)  DEFAULT '',
        email         VARCHAR(100) DEFAULT '',
        bio           TEXT,
        rating        DECIMAL(2,1) DEFAULT 4.5,
        is_active     TINYINT(1)   DEFAULT 1,
        created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Doctor availability table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS doctor_availability (
        id        INT AUTO_INCREMENT PRIMARY KEY,
        doctor_id INT NOT NULL,
        day       VARCHAR(20) NOT NULL,
        times     TEXT NOT NULL,
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
      )
    `);

    // Appointments table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        doctor_id  INT NOT NULL,
        date       VARCHAR(20)  NOT NULL,
        time       VARCHAR(10)  NOT NULL,
        reason     VARCHAR(500) DEFAULT '',
        notes      VARCHAR(500) DEFAULT '',
        status     ENUM('pending','confirmed','completed','cancelled') DEFAULT 'pending',
        fee        INT          DEFAULT 0,
        created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES users(id)   ON DELETE CASCADE,
        FOREIGN KEY (doctor_id)  REFERENCES doctors(id) ON DELETE CASCADE
      )
    `);

    console.log("✅ All tables ready");
  } finally {
    conn.release();
  }
};

module.exports = { pool, initDB };