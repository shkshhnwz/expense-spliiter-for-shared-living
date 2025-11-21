const express = require('express');
const authRouter = express.Router();
const authController = require("../controller/authController");

// Auth Routes
authRouter.get('/register', authController.getregister);
authRouter.post('/register', authController.postregister);
authRouter.get('/login', authController.getlogin);
authRouter.post('/sessionLogin', authController.postSessionLogin);
authRouter.get('/logout', authController.getlogout);
authRouter.get('/logout-success', authController.getlogoutsuccess);

// Forgot Password Flow
authRouter.get('/forgotpassword', authController.getforgotpassword);
authRouter.post('/forgotpassword', authController.postforgotpassword); // Sends Email

// OTP & Reset Flow
authRouter.get('/otpgetter', authController.getOtpPage); // Shows the OTP Page
authRouter.post('/verify-reset', authController.verifyAndReset); // Verifies and Changes Password

module.exports = authRouter;