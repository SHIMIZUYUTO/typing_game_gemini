import { auth, db } from './firebase_auth.js';
import { doc, getDoc, setDoc, collection, addDoc, getDocs, deleteDoc, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

// ハイスコア取得
export async function getHighScore(user) {
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
        return userDocSnap.data().highScore || 0;
    }
    return 0;
}

// ハイスコア保存
export async function saveHighScore(user, score) {
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, { highScore: score }, { merge: true });
}

// topMistakeKeys取得
export async function getTopMistakeKeys(user) {
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
        return userDocSnap.data().topMistakeKeys || [];
    }
    return [];
}

// topMistakeKeys保存
export async function saveTopMistakeKeys(user, keys) {
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, { topMistakeKeys: keys }, { merge: true });
}

// プログラムを保存（最大5つまで、古い順に削除）
export async function saveUserProgram(user, code) {
    if (!user) return;

    const programsCol = collection(db, 'users', user.uid, 'programs');
    // 既存のプログラムを取得（古い順）
    const q = query(programsCol, orderBy('savedAt', 'asc'));
    const snapshot = await getDocs(q);

    // 5つ以上なら古いものから削除
    if (snapshot.size >= 5) {
        const docsToDelete = snapshot.docs.slice(0, snapshot.size - 4); // 4つ残す
        for (const docSnap of docsToDelete) {
            await deleteDoc(docSnap.ref);
        }
    }

    // 新しいプログラムを追加
    await addDoc(programsCol, {
        code,
        savedAt: new Date()
    });
}