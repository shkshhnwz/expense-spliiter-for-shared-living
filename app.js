require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const admin = require('firebase-admin');
const mongoose = require('mongoose');
const session = require('express-session');
const cookieParser = require('cookie-parser');

// Local modules
const authRouter = require("./Backend/routes/authhandling");
const storerouter = require("./Backend/routes/storehandling");
const isAuth = require('./Backend/middlewares/isAuth'); // Import middleware but don't use it globally yet

// Firebase Setup
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// View Engine
app.set('view engine', 'ejs');
// ensuring correct path to views
app.set('views', path.join(__dirname, 'Frontend/views')); 

// Middleware (Global)
app.use(cookieParser());
app.use(session({
    secret: 'shah', // In production, move this to .env
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' } 
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'Backend/public')));

// --- ROUTES ---

// 1. Auth Routes (Login, Register, Forgot Password)
// These must be accessible WITHOUT logging in, so they go BEFORE isAuth
app.use(authRouter); 

// 2. Protected Routes (Dashboard)
// We apply 'isAuth' only to the dashboard routes
app.use('/dashboard', isAuth, storerouter);

// 3. Root Redirect
app.get('/', (req, res) => {
    // Check session or cookie here to decide redirect
    if (req.session && req.session.user) { 
        return res.redirect('/dashboard');
    }
    res.redirect('/login'); 
});

// Database & Server Start
const PORT = process.env.PORT || 3000; 
const DB_PATH = process.env.MONGO_URI; 

mongoose.connect(DB_PATH)
  .then(() => {
    console.log("✅ MongoDB is connected");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on address http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.log("❌ Error while connecting to mongodb", err);
  });