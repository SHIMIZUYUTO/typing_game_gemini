// import firebase from 'firebase/app';
// import 'firebase/auth';

// // FirebaseのプロジェクトIDとAPIキーを設定する
// const firebaseConfig = {
//     apiKey: 'AIzaSyBW_5YU8b3vRSrmWtza7Tx50XQcR1s8U_c',
//     authDomain: 'typing-game-a8239.firebaseapp.com',
//     projectId: 'typing-game-a8239',
// };

// // Firebaseを初期化する
// firebase.initializeApp(firebaseConfig);

// Firebase Authentication の機能を CDN からインポート
import {
  getAuth,
  signInWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';

// Firebase App はすでに index.html で初期化済みと仮定
const auth = getAuth(); // デフォルトの Firebase App を使用

// ログイン機能
export const login = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      console.log('ログイン成功:', user);
    })
    .catch((error) => {
      console.error('ログイン失敗:', error);
      throw error;
    });
};
