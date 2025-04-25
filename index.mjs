// backend/index.mjs
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import multer from "multer";
import nodemailer from "nodemailer";


dotenv.config();


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
const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

//Semitone ka systummm

//Session Configuration
app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 1 day
  })
);

// Passport Initialization
app.use(passport.initialize());
app.use(passport.session());

// Middleware to log session and user
app.use((req, res, next) => {
  console.log("Session:", req.session);
  console.log("User:", req.user);
  next();
});

// Middleware to make user available in templates
app.use((req, res, next) => {
  if (req.isAuthenticated()) {
    db.query("SELECT * FROM users WHERE id = $1", [req.user.id], (err, results) => {
      if (err) {
        console.error("Error fetching user:", err);
        return res.status(500).send("Internal Server Error");
      }
      req.user = results.rows[0] || null;
      next();
    });
  } else {
    res.locals.user = req.session.user || null;
    next();
  }
});

// Authentication Middleware
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated() && req.user) {
      return next();
  }
  res.redirect("/login");
}

// Passport Configuration
passport.use(
  new Strategy(async (username, password, done) => {
      try {
          const result = await db.query("SELECT * FROM users WHERE email = $1", [username]);
          if (result.rows.length > 0) {
              const user = result.rows[0];
              bcrypt.compare(password, user.password, (err, isValid) => {
                  if (err) return done(err);
                  return isValid ? done(null, user) : done(null, false);
              });
          } else {
              return done(null, false);
          }
      } catch (err) {
          console.error("Login error:", err);
          return done(err);
      }
  })
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
      const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
      if (result.rows.length > 0) {
          done(null, result.rows[0]); // Pass the user object to the request
      } else {
          done(new Error('User not found'));
      }
  } catch (err) {
      done(err);
  }
});

app.get("/", (req, res) => {
  // Ensure the user is logged in
  if (!req.user || !req.user.id) {
      return res.redirect("/login"); // Redirect to login if no user session
  }

  // Fetch user profile from database
  db.query("SELECT * FROM users WHERE id = $1", [req.user.id], (err, result) => {
      if (err) {
          console.error("Error fetching profile:", err);
          return res.status(500).send("Internal Server Error");
      }

      // Render the home view with user data
      const user = result.rows[0];
      res.render("home", { user });
  });
});

app.get("/login", (req, res) => res.render("login"));

app.post(
  "/login",
  passport.authenticate("local", { failureRedirect: "/login" }),
  (req, res) => {
    // Redirect based on user role
    if (req.user.role === "student") {
      res.redirect(`/dashboard/student/${req.user.id}`); // Student Dashboard
    } else if (req.user.role === "mentor") {
      res.redirect(`/dashboard/mentor/${req.user.id}`); // Mentor Dashboard
    } else {
      res.redirect("/"); // Default fallback
    }
  }
);



app.get("/register", (req, res) => res.render("register"));

app.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).send("All fields are required.");
  }

  try {
    // Check if email already exists
    const userExists = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (userExists.rows.length > 0) {
      return res.redirect("/login"); // Redirect to login if user already exists
    }

    // Insert new user
    const result = await db.query(
      `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, email, password, role]
    );

    const user = result.rows[0];

    // Set session or login logic here (if any), then redirect
    res.redirect("/login");
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).send("Something went wrong.");
  }
});

// ROUTES

// // Register User (Student or Mentor)
// app.post('/api/register', async (req, res) => {
//   const { name, email, password, role, expertise, bio } = req.body;
//   try {
//     const result = await db.query(
//       'INSERT INTO users (name, email, password, role, expertise, bio) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
//       [name, email, password, role, expertise || null, bio || null]
//     );
//     res.status(201).json(result.rows[0]);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// });

// Submit Idea
app.post('/api/ideas', async (req, res) => {
  const { title, description, student_id, sdg_tag_id, needs } = req.body;
  try {
    const result = await db.query(
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
    const result = await db.query(
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
    const result = await db.query('SELECT * FROM ideas');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Match Mentor to Idea
app.post('/api/matches', async (req, res) => {
  const { idea_id, mentor_id } = req.body;
  try {
    const result = await db.query(
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
    const result = await db.query('SELECT * FROM funding_opportunities');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
