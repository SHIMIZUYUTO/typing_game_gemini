import { login, signUp } from './firebase_auth.js';
// import { createUserProfile } from './firebase_helper.js'; // No longer needed here

const loginForm = document.getElementById('login-form');
const signupButton = document.getElementById('signup-button');
const loginButton = document.getElementById('login-button');
const usernameField = document.getElementById('username-field');
const usernameInput = document.getElementById('username');

let isSignUpMode = false;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-container').style.display = 'block';
});

// '新規登録' button toggles sign up mode
signupButton.addEventListener('click', () => {
    isSignUpMode = !isSignUpMode;
    if (isSignUpMode) {
        document.querySelector('#login-form h1').textContent = '新規登録';
        usernameField.style.display = 'block';
        loginButton.textContent = '登録して開始';
        signupButton.textContent = 'ログインに戻る';
        usernameInput.required = true;
    } else {
        document.querySelector('#login-form h1').textContent = 'ログイン画面';
        usernameField.style.display = 'none';
        loginButton.textContent = 'ログイン';
        signupButton.textContent = '新規登録';
        usernameInput.required = false;
    }
});

// Handle both login and sign up
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (isSignUpMode) {
        // --- Sign Up Flow ---
        const username = usernameInput.value;
        if (!username) {
            alert('ユーザー名を入力してください。');
            return;
        }

        try {
            // Pass username to the updated signUp function
            const userCredential = await signUp(email, password, username);
            if (userCredential && userCredential.user) {
                showHomeScreen();
            }
        } catch (error) {
            alert('新規登録に失敗しました。\n' + error.message);
        }

    } else {
        // --- Login Flow ---
        try {
            await login(email, password);
            showHomeScreen();
        } catch (error) {
            alert('メールアドレスもしくはパスワードが間違っています');
        }
    }
});

function showHomeScreen() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('home-container').style.display = 'flex';
    // This event will be caught by another script to display the username
    document.dispatchEvent(new Event('userLoggedIn'));
}
