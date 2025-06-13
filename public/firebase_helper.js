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

    // お気に入り以外のプログラムのみカウント
    const nonFavoriteDocs = snapshot.docs.filter(doc => !doc.data().favorite);
    // 5つ以上なら古い「お気に入りでない」ものから削除
    if (nonFavoriteDocs.length >= 5) {
        const docsToDelete = nonFavoriteDocs.slice(0, nonFavoriteDocs.length - 4);
        for (const docSnap of docsToDelete) {
            await deleteDoc(docSnap.ref);
        }
    }

    // 新しいプログラムを追加（デフォルトはお気に入りfalse）
    await addDoc(programsCol, {
        code,
        savedAt: new Date(),
        favorite: false
    });
}

// お気に入り状態を切り替える
export async function toggleFavoriteProgram(user, programId, currentFavorite) {
    if (!user || !programId) return;
    const programRef = doc(db, 'users', user.uid, 'programs', programId);
    await setDoc(programRef, { favorite: !currentFavorite }, { merge: true });
}

export async function getUserPrograms(user) {
    if (!user) return [];
    const programsCol = collection(db, 'users', user.uid, 'programs');
    const q = query(programsCol, orderBy('savedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        code: doc.data().code,
        savedAt: doc.data().savedAt?.toDate ? doc.data().savedAt.toDate() : doc.data().savedAt,
        favorite: !!doc.data().favorite
    }));
}