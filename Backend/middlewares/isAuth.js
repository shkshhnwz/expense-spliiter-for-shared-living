const admin = require('firebase-admin');
const User = require('../model/User'); 

module.exports = async (req, res, next) => {
    // 1. Get the session cookie
    const sessionCookie = req.cookies.__session || '';

    // 2. STRICT CHECK: If no cookie, kick them out immediately
    if (!sessionCookie) {
        console.log('isAuth: No cookie found. Redirecting to login.');
        return res.redirect('/login');
    }

    try {
        // 3. Verify the cookie with Firebase
        const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true);
        
        // 4. Find the user in MongoDB
        const user = await User.findOne({ firebaseUid: decodedClaims.uid });

        // 5. STRICT CHECK: If Firebase works but MongoDB doesn't know the user
        if (!user) {
            console.log('isAuth: User verified in Firebase but NOT found in MongoDB.');
            // This is likely where your Google Login loop is happening
            return res.redirect('/login');
        }

        // 6. Success! Attach user and proceed
        req.user = user;
        req.isLoggedIn = true;
        next();

    } catch (error) {
        // 7. Security cleanup if token is invalid
        console.error("isAuth Error:", error.message);
        res.clearCookie('__session');
        return res.redirect('/login');
    }
};