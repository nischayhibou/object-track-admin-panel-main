import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/index.js';
import Joi from 'joi';
import fs from 'fs';
const config = JSON.parse(fs.readFileSync(new URL('../config/config.json', import.meta.url)));

const {
  jwtSecret,
  cookieName,
  cookieOptions
} = config.server;

const userSchema = Joi.object({
  firstname: Joi.string().min(2).max(100).required(),
  lastname: Joi.string().min(2).max(100).required(),
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(6).required(),
  mobile: Joi.string().pattern(/^[0-9]{10}$/).required(),
  email: Joi.string().email().required()
});

export const register = async (req, res) => {
  const { error, value } = userSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { firstname, lastname, username, password, mobile, email } = value;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO users (firstname, lastname, username, password, mobile, email)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await pool.query(query, [firstname, lastname, username, hashedPassword, mobile, email]);

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid username' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid password' });

    const token = jwt.sign({ userId: user.userid }, jwtSecret, { expiresIn: cookieOptions.maxAgeMs / 1000 + 's' });

    res.cookie(cookieName, token, cookieOptions);
    res.json({ message: 'Login successful', token, username, userId: user.userid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const logout = (req, res) => {
  res.clearCookie(cookieName);
  res.json({ message: 'Logged out successfully' });
};

export const getUserInfo = async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const { password, ...safeUser } = result.rows[0];
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};