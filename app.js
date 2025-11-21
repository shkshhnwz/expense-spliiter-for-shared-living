require('dotenv').config();
//external Module
const express = require('express');
const path = require('path');
const app = express();
const admin = require('firebase-admin');
const {default : mongoose} = require('mongoose');
const DB_PATH = "mongodb+srv://shahnawazshaikh:shah1201@expense-splitter.kukbpia.mongodb.net/";
const session = require('express-session');
const cookieParser = require('cookie-parser');


//Local module
const authRouter = require("./Backend/routes/authhandling");
const storerouter = require("./Backend/routes/storehandling");
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'Frontend/views'));
const serviceAccount = require('./serviceAccountKey.json');
const isAuth = require('./Backend/middlewares/isAuth');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

//MiddleWares
app.use(cookieParser());
app.use(session({
    secret: 'shah',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' } 
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'Backend/public')));
app.use(isAuth);
app.use(authRouter);
app.use('/dashboard',storerouter);
app.get('/', (req, res) => {
    if (req.user) { 
        return res.redirect('/dashboard');
    }
    res.redirect('/login'); 
});

//Server
const PORT = 3000;
mongoose.connect(DB_PATH).then(() => {
  console.log("MongoDB is connected");
  app.listen(PORT, () => {
    console.log(`Server running on address http://localhost:${PORT}`);
  });
}).catch(err => {
  console.log("Error while connecting to mongodb", err);
})