const admin = require('firebase-admin');
const User = require('../model/User'); 

exports.getlogin = (req, res, next) => {
    res.render("auth/login", {
        pageTitle: "Login Page",
        stylesheet: "/login.css"
    })
}

exports.getregister = (req, res, next) => {
    res.render("auth/register", {
        pageTitle: "SignUp Page",
        stylesheet: "/register.css"
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

exports.getlogout = async(req,res, next)=>{
    res.clearCookie('__session');
    const sessionCookie = req.cookies.__session || '';
    if(sessionCookie){
        try{
            const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie,true);
            await admin.auth().revokeRefreshTokens(decodedClaims.sub);
            console.log('Firebase session tokens revoked.');
        }catch(err){
            console.warn("Could not revoke FireBase token(It might be expired or invalid) ", err);
        }
    }

    res.redirect('/logout-success')
}

exports.getlogoutsuccess = (req,res,next) =>{
    res.render("auth/logout",{
        pageTitle : "Logout Successful",
        stylesheet: "/logout.css"
    }
    )
}
