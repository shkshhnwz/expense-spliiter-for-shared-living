// Example: Backend/middleware/isAuth.js
const admin = require('firebase-admin');
const User = require('../model/User'); // Assuming path to your User model

module.exports = async (req, res, next) => {
    // 1. Get the session cookie (set by postSessionLogin)
    const sessionCookie = req.cookies.__session || '';

    // 2. Clear cookie/Redirect if no cookie is present
    if (!sessionCookie) {
        req.user = null; // Ensure req.user is clean
        return next(); // Let subsequent middleware/routes handle authentication status (e.g., dashboard controller will redirect to /login)
    }

    // 3. Verify the cookie with Firebase
    try {
        // 'checkRevoked: true' checks if the session has been manually revoked
        const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true); 
        
        // 4. Find the corresponding user in MongoDB using the Firebase UID
        const user = await User.findOne({ firebaseUid: decodedClaims.uid });
        
        if (user) {
            req.user = user; // Attach the full MongoDB user object
        } else {
            // User exists in Firebase but not MongoDB (Shouldn't happen with your postregister)
            req.user = null;
        }

        next();
    } catch (error) {
        // If the cookie is expired, invalid, or revoked.
        res.clearCookie('__session');
        req.user = null;
        console.error("Session verification failed:", error.message);
        next(); 
    }
};