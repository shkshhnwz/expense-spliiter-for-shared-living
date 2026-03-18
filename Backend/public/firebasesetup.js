import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    GoogleAuthProvider, 
    signInWithPopup, 
    getRedirectResult 
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

// 1. Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCLGxqYOX2JVK4bLdKGAPYgY_LStdndMC4",
    authDomain: "exprense-splitter-webapp.firebaseapp.com",
    projectId: "exprense-splitter-webapp",
    storageBucket: "exprense-splitter-webapp.firebasestorage.app",
    messagingSenderId: "345042735000",
    appId: "1:345042735000:web:43fa746de95557d439e5ed"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// DOM Elements
const loginForm = document.getElementById('loginForm');
const authMessage = document.getElementById('authMessage');
const googleBtn = document.getElementById('google-signin-btn');

/**
 * SHARED UTILITY: Send Token to Node.js Backend
 * This is used by both login methods.
 */
async function handleBackendSession(user) {
    try {
        const idToken = await user.getIdToken();
        const response = await fetch('/sessionLogin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
        });

        if (response.ok) {
            window.location.href = '/dashboard';
        } else {
            throw new Error('Backend session creation failed');
        }
    } catch (error) {
        console.error("Backend Error:", error);
        if (authMessage) authMessage.textContent = "Server error. Please try again.";
    }
}

// --- 2. HANDLE GOOGLE REDIRECT (Runs automatically on page load) ---
getRedirectResult(auth)
    .then((result) => {
        if (result && result.user) {
            console.log("Logged in via Google:", result.user.email);
            handleBackendSession(result.user);
        }
    })
    .catch((error) => {
        console.error("Redirect Error:", error);
        if (authMessage) authMessage.textContent = `Google Error: ${error.message}`;
    });

// --- 3. HANDLE GOOGLE BUTTON CLICK ---
if (googleBtn) {
    googleBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const result = await signInWithPopup(auth, provider);
            console.log("Logged in via Google Popup:", result.user.email);
            handleBackendSession(result.user);
        } catch (error) {
            console.error("Popup Error:", error);
            if (authMessage) authMessage.textContent = `Google Error: ${error.message}`;
        }
    });
}

// --- 4. HANDLE EMAIL/PASSWORD LOGIN ---
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Ensure these IDs (emailuser, passworduser) match your HTML input names/IDs
        const email = loginForm.emailuser.value;
        const password = loginForm.passworduser.value;

        if (authMessage) {
            authMessage.textContent = "Signing in...";
            authMessage.style.color = "blue";
        }

        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                console.log("Logged in via Email:", userCredential.user.email);
                return handleBackendSession(userCredential.user);
            })
            .catch((error) => {
                console.error("Login Error:", error.code);
                if (authMessage) {
                    authMessage.style.color = "red";
                    // Friendly error messages
                    if (error.code === 'auth/user-not-found') authMessage.textContent = "User not found.";
                    else if (error.code === 'auth/wrong-password') authMessage.textContent = "Incorrect password.";
                    else authMessage.textContent = error.message;
                }
            });
    });
}