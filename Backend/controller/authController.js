const admin = require('firebase-admin');
const User = require('../model/User');
const otpgenerator = require('otp-generator');
const nodemailer = require('nodemailer');
const Otp = require('../model/otpmodel');

exports.getlogin = (req, res, next) => {
    res.render("auth/login", {
        pageTitle: "Login Page",
        stylesheet: "/login.css",
        user: req.user
    })
}

exports.getregister = (req, res, next) => {
    res.render("auth/register", {
        pageTitle: "SignUp Page",
        stylesheet: "/register.css",
        user: req.users
    })
}


exports.postregister = async (req, res, next) => {
    try {
        const { NameUser, emailuser, phone, passworduser } = req.body;
        const userRecord = await admin.auth().createUser({
            email: emailuser,
            password: passworduser,
            displayName: NameUser,
            phoneNumber: `+91${phone}`
        });
        const newUser = new User({
            firebaseUid: userRecord.uid,
            name: NameUser,
            email: emailuser,
            phone: phone
        });
        await newUser.save();
        console.log('Successfully created new user:', userRecord.uid);
        res.redirect('/login');
    } catch (error) {
        console.error("Error during user registration:", error);
        res.status(500).send('Registration failed. The email might already be in use.');
    }
};




exports.postSessionLogin = async (req, res) => {
    try {
        const idToken = req.body.idToken.toString();
        const expiresIn = 60 * 60 * 24 * 5 * 1000;
        const sessionCookie = await admin
            .auth()
            .createSessionCookie(idToken, { expiresIn });
        const options = { maxAge: expiresIn, httpOnly: true, secure: process.env.NODE_ENV === 'production' };
        res.cookie('__session', sessionCookie, options);
        console.log('User authenticated and session cookie set.');
        res.status(200).send({ status: 'success', message: 'Session cookie set' });

    } catch (error) {
        console.error("Error during session login:", error);
        res.status(401).send('UNAUTHORIZED REQUEST! Failed to create session.');
    }
};

exports.getlogout = async (req, res, next) => {
    res.clearCookie('__session');
    const sessionCookie = req.cookies.__session || '';
    if (sessionCookie) {
        try {
            const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true);
            await admin.auth().revokeRefreshTokens(decodedClaims.sub);
            console.log('Firebase session tokens revoked.');
        } catch (err) {
            console.warn("Could not revoke FireBase token(It might be expired or invalid) ", err);
        }
    }

    res.redirect('/logout-success')
}

exports.getlogoutsuccess = (req, res, next) => {
    res.render("auth/logout", {
        pageTitle: "Logout Successful",
        stylesheet: "/logout.css"
    }
    )
}

exports.getforgotpassword = (req, res, next) => {
    res.render("auth/forgotpassword", {
        user: req.user,
        pageTitle: "Forgot Password",
        stylesheet: "/forgotpassword.css"
    });

}

console.log("User:", process.env.EMAIL_USER); // Should print your email
console.log("Pass:", process.env.EMAIL_PASS ? "Loaded" : "Not Loaded"); // Should print "Loaded"


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

exports.postforgotpassword = async (req, res, next) => {
    const { emailuser } = req.body;

    try {
        // 1. Check if user exists in Firebase
        await admin.auth().getUserByEmail(emailuser);

        // 2. Generate OTP
        const otp = otpgenerator.generate(6, {
            upperCaseAlphabets: false,
            specialChars: false,
            lowerCaseAlphabets: false,
            digits: true,
        });

        // 3. Save to DB (Fixed the 'One' error and query key)
        // Assuming your OTP Model schema uses 'email', but we map 'emailuser' to it
        await Otp.findOneAndUpdate(
            { email: emailuser }, 
            { otp: otp },
            { upsert: true, new: true, setDefaultsOnInsert: true } 
        );

        // 4. Send Email
        const mailOptions = {
            from: `"Expense Splitter Support" <${process.env.EMAIL_USER}>`,
            to: emailuser,
            subject: 'Password Reset Request',
            html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Password Reset</h2>
          <p>You requested to reset your password. Use the code below:</p>
          <h1 style="color: #2c3e50; letter-spacing: 5px;">${otp}</h1>
          <p>This code expires in 5 minutes.</p>
        </div>
      `,
        };

        await transporter.sendMail(mailOptions);
        console.log("Forgot password mail has been sent");

        // 5. Redirect to the OTP Page (Pass email in query so user doesn't have to retype it)
        res.redirect(`/otpgetter?email=${emailuser}`);

    } catch (error) { // Fixed: Changed 'err' to 'error' to match usage
        if (error.code === 'auth/user-not-found') {
            // Return error to the view instead of JSON if possible, or handle on frontend
            console.log("User not found");
            return res.redirect('/forgotpassword?error=User not found');
        }

        console.error("OTP Error:", error);
        res.status(500).send("Internal Server Error");
    }
}

// --- OTP PAGE RENDER ---
// Renamed from OtpGetter to getOtpPage to avoid conflict
exports.getOtpPage = (req, res, next) => {
    const email = req.query.email || ''; // Get email from URL if present
    
    // Fixed: Render 'auth/otpgetter' based on your screenshot
    res.render('auth/otpgetter', {
        pageTitle: 'Verify OTP',
        stylesheet: '/otpgetter.css',
        user: req.user,
        email: email // Pass email to EJS to auto-fill the box
    });
}

// --- VERIFY AND RESET LOGIC ---
// Renamed from OtpGetter to verifyAndReset
exports.verifyAndReset = async (req, res) => {
    const { emailuser, otp, newPassword } = req.body;

    try {
        if (!emailuser || !otp || !newPassword) {
            return res.status(400).send("All fields are required");
        }

        // 1. Find OTP in DB (Make sure your Schema uses 'email' or 'emailuser')
        // Usually schemas use 'email' as the key
        const otpRecord = await Otp.findOne({ email: emailuser });

        if (!otpRecord) {
            return res.status(400).send("OTP expired or invalid.");
        }

        if (otpRecord.otp !== otp) {
            return res.status(400).send("Incorrect OTP.");
        }

        // 2. Get User UID
        const userRecord = await admin.auth().getUserByEmail(emailuser); // Fixed: used emailuser

        // 3. Update Password
        await admin.auth().updateUser(userRecord.uid, {
            password: newPassword,
        });

        // 4. Delete used OTP
        await Otp.deleteOne({ email: emailuser });

        console.log("Password reset successful");
        res.redirect('/login?message=PasswordResetSuccess');

    } catch (error) {
        console.error("Reset Error:", error);
        res.status(500).send("Failed to reset password.");
    }
};