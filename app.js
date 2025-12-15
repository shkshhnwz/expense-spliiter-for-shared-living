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
const isAuth = require('./Backend/middlewares/isAuth'); 

// Firebase Setup
const admin = require('firebase-admin');

let serviceAccount;
// Check if we are running on the server (Render)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // We are running locally, so look for the file
  serviceAccount = require('./serviceAccountKey.json');
}

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
    secret:process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'Backend/public')));

app.use(authRouter); 

app.use('/dashboard', isAuth, storerouter);

app.get('/', (req, res) => {
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