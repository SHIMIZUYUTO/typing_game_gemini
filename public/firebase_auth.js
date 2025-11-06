// Firebase Authenticationをインポート
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';

// Firestoreをインポート
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

// Firebase AuthenticationとFirestoreのインスタンスを取得
const auth = getAuth();
const db = getFirestore();

export { auth, db }; 

// ログイン機能
export const login = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password)
    .then(async (userCredential) => {
      const user = userCredential.user;
      console.log('ログイン成功:', user);

      // Firestoreにユーザードキュメントを作成またはスキップ
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          email: user.email,
          createdAt: new Date(),
          highScore: 0
        });
        console.log('新しいユーザードキュメントを作成しました');
      }
      return userCredential;
    })
    .catch((error) => {
      console.error('ログイン失敗:', error);
      throw error;
    });
};

// 新規登録機能
export const signUp = (email, password, username) => {
  return createUserWithEmailAndPassword(auth, email, password)
    .then(async (userCredential) => {
      const user = userCredential.user;
      console.log('新規登録成功:', user);

      // Firestoreにユーザードキュメントを作成
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        username: username, // Add username
        email: user.email,
        createdAt: new Date(),
        highScore: 0
      });
      console.log('新しいユーザードキュメントを作成しました');
      return userCredential; // Return the userCredential
    })
    .catch((error) => {
      console.error('新規登録失敗:', error);
      throw error;
    });
};
