// Firebase Authenticationをインポート
import {
  getAuth,
  signInWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';

// Firestoreをインポート
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

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
      const userDocRef = doc(db, 'users', user.uid);        // ドキュメントの参照を取得
      const userDocSnap = await getDoc(userDocRef);          // ドキュメントのスナップショットを取得

      if (!userDocSnap.exists()) {
        // ドキュメントが存在しない場合のみ、新規作成
        await setDoc(userDocRef, {
          email: user.email,     // メールアドレス
          createdAt: new Date(), // アカウント作成日時
          highScore: 0           // 初期スコア
        });
        console.log('新しいユーザードキュメントを作成しました');
      } else {
        // 既にドキュメントが存在する場合、何もしない
      }

    })
    .catch((error) => {
      console.error('ログイン失敗:', error);
      throw error;
    });
};
