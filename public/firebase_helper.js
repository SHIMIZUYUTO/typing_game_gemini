import { auth, db } from './firebase_auth.js';
import { doc, getDoc, setDoc, collection, addDoc, getDocs, deleteDoc, query, orderBy, limit, where, runTransaction } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

// ユーザープロファイル取得
export async function getUserProfile(user) {
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
        return userDocSnap.data();
    }
    return null;
}

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

// 平均打鍵速度を保存
export async function saveUserTypingSpeed(user, speed) {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, { averageSpeed: speed }, { merge: true });
}

// 1回ごとのタイピング速度を記録
export async function addTypingSession(user, speed) {
    if (!user) return;
    const sessionsCol = collection(db, 'users', user.uid, 'typingSessions');
    await addDoc(sessionsCol, {
        speed: speed,
        createdAt: new Date()
    });
}

// 3回以上記録があれば、最新3回の平均を計算・保存し、古い記録は削除
export async function updateAverageSpeedIfNeeded(user) {
    if (!user) return;
    const sessionsCol = collection(db, 'users', user.uid, 'typingSessions');
    const q = query(sessionsCol, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const sessions = snapshot.docs;
    
    if (sessions.length >= 3) {
        const latest3Speeds = sessions.slice(0, 3).map(doc => doc.data().speed);
        const averageSpeed = latest3Speeds.reduce((a, b) => a + b, 0) / latest3Speeds.length;

        // 平均速度を保存
        await saveUserTypingSpeed(user, Math.round(averageSpeed * 100) / 100);

        // 4件目以降の古い記録を削除
        if (sessions.length > 3) {
            const sessionsToDelete = sessions.slice(3);
            for (const docSnap of sessionsToDelete) {
                await deleteDoc(docSnap.ref);
            }
        }
    }
}

function getTypingDay() {
    const now = new Date();
    // A day starts at 6 AM. If it's before 6 AM, it's part of the previous day.
    if (now.getHours() < 6) {
        now.setDate(now.getDate() - 1);
    }
    // Format as YYYY-MM-DD
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export async function updateDailyAverageSpeed(user, speed) {
    if (!user) return;

    const typingDay = getTypingDay();
    const dailyAverageDocRef = doc(db, 'users', user.uid, 'dailyAverages', typingDay);

    try {
        await runTransaction(db, async (transaction) => {
            const dailyDoc = await transaction.get(dailyAverageDocRef);

            if (!dailyDoc.exists()) {
                // New day, create a new document
                transaction.set(dailyAverageDocRef, {
                    totalSpeed: speed,
                    sessionCount: 1,
                    averageSpeed: speed,
                    date: new Date(typingDay) // Store the date for sorting if needed
                });
            } else {
                // Existing day, update the document
                const data = dailyDoc.data();
                const newSessionCount = data.sessionCount + 1;
                const newTotalSpeed = data.totalSpeed + speed;
                const newAverageSpeed = newTotalSpeed / newSessionCount;

                transaction.update(dailyAverageDocRef, {
                    totalSpeed: newTotalSpeed,
                    sessionCount: newSessionCount,
                    averageSpeed: newAverageSpeed
                });
            }
        });
    } catch (e) {
        console.error("Transaction failed: ", e);
    }
}

export async function recordLoginDay(user) {
    if (!user) return;
    const dateString = getTypingDay(); // Reuse the existing logic for a consistent definition of a "day"
    const loginDayRef = doc(db, 'users', user.uid, 'loginDays', dateString);
    await setDoc(loginDayRef, { loggedInAt: new Date() });
}

export async function getLoginDayCount(user) {
    if (!user) return 0;
    const loginDaysCol = collection(db, 'users', user.uid, 'loginDays');
    const snapshot = await getDocs(loginDaysCol);
    return snapshot.size;
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

// チャット履歴を取得（idも返すように修正）
export async function getProgramMessages(user, programId) {
    if (!user || !programId) return [];
    const messagesCol = collection(db, 'users', user.uid, 'programs', programId, 'messages');
    const q = query(messagesCol, orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

// チャット履歴の単一メッセージを削除
export async function deleteProgramMessage(user, programId, messageId) {
    if (!user || !programId || !messageId) return;
    const msgRef = doc(db, 'users', user.uid, 'programs', programId, 'messages', messageId);
    await deleteDoc(msgRef);
}

// チャット履歴を追加
export async function addProgramMessage(user, programId, role, text) {
    if (!user || !programId) return;
    const messagesCol = collection(db, 'users', user.uid, 'programs', programId, 'messages');
    await addDoc(messagesCol, {
        role,
        text,
        createdAt: new Date()
    });
}

// クイズ結果を保存
export async function saveQuizResult(user, resultData) {
    if (!user || !resultData) return;
    const resultsCol = collection(db, 'users', user.uid, 'quizResults');
    await addDoc(resultsCol, {
        ...resultData,
        userId: user.uid,
        timestamp: new Date()
    });
}

// 過去のクイズ結果を取得
export async function getQuizResults(user) {
    if (!user) return [];
    const resultsCol = collection(db, 'users', user.uid, 'quizResults');
    const q = query(resultsCol, orderBy('timestamp', 'desc'), limit(20)); // 直近20件まで
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

// ランキング取得
export async function getRanking() {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('averageSpeed', '!=', null), orderBy('averageSpeed', 'desc'));
    const snapshot = await getDocs(q);
    // doc.data()に加えてdoc.idも返すように修正
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}