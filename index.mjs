import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import session from "express-session";
import twilio from "twilio";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));



// ✅ Session middleware
app.use(
  session({
    secret: "your-secret-key", // use dotenv for secret in production
    resave: false,
    saveUninitialized: true,
  })
);

// ✅ Make session user available to views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "ideanest",
  password: "1234",
  port: 5432,
});

db.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err) => console.error("❌ Connection error", err.stack));

  const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);


app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/hackdash", (req, res) => {
  res.render("hackdash.ejs");
});

app.get("/profile", (req, res) => {
  res.render("profile.ejs");
});
app.get("/explorementor", (req, res) => {
  res.render("explorementor.ejs");
});

app.get("/video-call", (req, res) => {
  res.render("video-call.ejs");
});

app.get("/explore", (req, res) => {
  res.render("explore.ejs");
});



app.get("/aboutus", (req, res) => {
  res.render("aboutus.ejs");
});
app.get("/submit", (req, res) => {
  res.render("submit.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
  console.log("🔁 Form submitted");
  console.log(req.body); 
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hash]);
  res.redirect('/login.html');
});

app.post("/login", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const storedPassword = user.password;

      if (password === storedPassword) {
        // ✅ Set session user
        req.session.user = {
          id: user.id,
          name: user.name,
          profile_image: user.profile_image,
        };
        res.redirect("/");
      } else {
        res.send("Incorrect Password");
      }
    } else {
      res.send("User not found");
    }
  } catch (err) {
    console.log(err);
  }
});

// ✅ Profile route

// ✅ Logout route (optional)
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.post("/sendWhatsApp", async (req, res) => {
  const { userMessage } = req.body;

  try {
    const message = await twilioClient.messages.create({
      body: userMessage,
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: process.env.TWILIO_WHATSAPP_TO,
    });

    console.log("✅ WhatsApp message sent:", message.sid);
    res.status(200).json({ success: true, sid: message.sid });
  } catch (error) {
    console.error("❌ WhatsApp Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
