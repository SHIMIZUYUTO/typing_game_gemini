import { login } from './firebase_auth.js';

const loginForm = document.getElementById('login-form');

document.addEventListener('DOMContentLoaded', () => {
  // ログイン画面を表示する
  document.getElementById('login-container').style.display = 'block';
  // ログイン前は題材入力欄を非表示
  document.getElementById('custom-theme-box').style.display = 'none';
});

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  login(email, password)
    .then(() => {
      document.getElementById('login-container').style.display = 'none';
      document.getElementById('typing-container').style.display = 'block';
      // ログイン後に題材入力欄を表示
      document.getElementById('custom-theme-box').style.display = 'block';
    })
    .catch((error) => {
      alert('メールアドレスもしくはパスワードが間違っています');
    });
});
