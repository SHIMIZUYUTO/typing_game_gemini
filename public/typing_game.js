import { auth } from './firebase_auth.js';
import { getUserProfile } from './firebase_helper.js';
import { setupGameEvents } from './game_logic.js';

async function displayUsername() {
    const user = auth.currentUser;
    if (!user) return;

    const userWelcome = document.getElementById('user-welcome');
    const profile = await getUserProfile(user);

    if (profile && profile.username) {
        userWelcome.textContent = `${profile.username} さん`;
    } else {
        userWelcome.textContent = 'no nameさん';
    }
}

document.addEventListener("DOMContentLoaded", () => {
    setupGameEvents();
    // Listen for the custom event dispatched from login.js
    document.addEventListener('userLoggedIn', displayUsername);
});