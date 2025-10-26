const express = require('express');
const authRouter = express.Router();

const authController = require("../controller/authController");

authRouter.get('/register', authController.getregister);
authRouter.post('/register', authController.postregister);
authRouter.post('/sessionLogin', authController.postSessionLogin);
authRouter.get('/login', authController.getlogin);
authRouter.get('/logout', authController.getlogout);
authRouter.get('/logout-success', authController.getlogoutsuccess);
module.exports = authRouter;