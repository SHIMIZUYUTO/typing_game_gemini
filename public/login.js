import { login } from './firebase_auth.js';

const loginForm = document.getElementById('login-form');

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  login(email, password)
    .then(() => {
      document.getElementById('login-container').style.display = 'none';
      document.getElementById('typing-container').style.display = 'block';
    })
    .catch((error) => {
      alert('メールアドレスもしくはパスワードが間違っています');
    });
});
