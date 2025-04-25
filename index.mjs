// backend/index.mjs
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const { Pool } = pkg;


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));





app.use(cors());
app.use(bodyParser.json());


// PostgreSQL pool setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.get('/', (req, res) => {
  res.render('index'); // this will render views/index.ejs
});


// ROUTES

// Register User (Student or Mentor)
app.post('/api/register', async (req, res) => {
  const { name, email, password, role, expertise, bio } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role, expertise, bio) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, email, password, role, expertise || null, bio || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Submit Idea
app.post('/api/ideas', async (req, res) => {
  const { title, description, student_id, sdg_tag_id, needs } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO ideas (title, description, student_id, sdg_tag_id, needs) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, description, student_id, sdg_tag_id, needs]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Register Mentor Profile
app.post('/api/mentors', async (req, res) => {
  const { user_id, domains, available_times, contact } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO mentors (user_id, domains, available_times, contact) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_id, domains, available_times, contact]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get All Ideas
app.get('/api/ideas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ideas');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Match Mentor to Idea
app.post('/api/matches', async (req, res) => {
  const { idea_id, mentor_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO matches (idea_id, mentor_id, status) VALUES ($1, $2, $3) RETURNING *',
      [idea_id, mentor_id, 'pending']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get Funding Opportunities
app.get('/api/funding', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM funding_opportunities');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
