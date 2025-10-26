// Import the functions you need from the SDKs you need
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js';
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCLGxqYOX2JVK4bLdKGAPYgY_LStdndMC4",
  authDomain: "exprense-splitter-webapp.firebaseapp.com",
  projectId: "exprense-splitter-webapp",
  storageBucket: "exprense-splitter-webapp.firebasestorage.app",
  messagingSenderId: "345042735000",
  appId: "1:345042735000:web:43fa746de95557d439e5ed",
  measurementId: "G-49PVPRJED0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

//exporting
export const auth = getAuth(app);

//Define the Google auth Provider
const provider = new GoogleAuthProvider();


// 4. ADD THE AUTHENTICATION LOGIC
// Get the form and the message div from the DOM
const loginForm = document.getElementById('loginForm');
const authMessage = document.getElementById('authMessage');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = loginForm.emailuser.value;
    const password = loginForm.passworduser.value;

    // 1. Sign in with Firebase on the client
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            authMessage.textContent = 'Login successful! Verifying with server...';
            authMessage.style.color = 'green';
            // 2. Get the ID Token
            return userCredential.user.getIdToken();
        })
        .then((idToken) => {
            // 3. Send the token to your backend
            return fetch('/sessionLogin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
            });
        })
        .then(response => {
            if (response.ok) {
                // 4. If server is happy, redirect to the dashboard
                window.location.href = '/dashboard'; // Or your main app page
            } else {
                throw new Error('Server verification failed.');
            }
        })
        .catch((error) => {
            console.error("Authentication Error:", error);
            authMessage.textContent = `Error: ${error.message}`;
            authMessage.style.color = 'red';
        });
});


const googleBtn = document.getElementById('google-signin-btn');
googleBtn.addEventListener('click', () => {
    signInWithPopup(auth, provider)
        .then((result) => {
            console.log("Successfully signed in with Google:", result.user.displayName);
            return result.user.getIdToken();
        })
        .then((idToken) => {
            return fetch('/sessionLogin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
            });
        })
        .then(response => {
            if (response.ok) {
                window.location.href = '/dashboard';
                return;
            } else {
                throw new Error('Server verification failed.');
            }

           
        })
        .catch((error) => {
            console.error("Google Sign-In Error:", error.message);
            const authMessage = document.getElementById('authMessage');
            if (authMessage) {
                authMessage.textContent = `Error: ${error.message}`;
                authMessage.style.color = 'red';
            }
        });
});