const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db.js");

const SALT_ROUNDS = 12;

exports.registerUser = async ({ email, password, name }) => {
  if (!email || !password || !name) {
    const error = new Error("All fields are required");
    error.status = 400;
    throw error;
  }

  const existingUser = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );

  if (existingUser.rows.length > 0) {
    const error = new Error("Email already registered");
    error.status = 400;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const result = await pool.query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, abha_linked`,
    [email, hashedPassword, name]
  );

  return result.rows[0];
};

exports.loginUser = async ({ email, password }) => {
  if (!email || !password) {
    const error = new Error("Email and password required");
    error.status = 400;
    throw error;
  }

  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  if (result.rows.length === 0) {
    const error = new Error("Invalid credentials");
    error.status = 401;
    throw error;
  }

  const user = result.rows[0];

  const isMatch = await bcrypt.compare(password, user.password_hash);

  if (!isMatch) {
    const error = new Error("Invalid credentials");
    error.status = 401;
    throw error;
  }

  const token = jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      abha_linked: user.abha_linked,
    },
  };
};