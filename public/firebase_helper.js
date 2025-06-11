import { auth, db } from './firebase_auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

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