const express = require('express');
const { getFirestore, collection, getDocs, addDoc } = require('firebase/firestore');
const { initializeApp } = require('firebase/app');
require('dotenv').config();

// Firebaseの初期化設定
const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: process.env.AUTH_DOMAIN,
  projectId: process.env.PROJECT_ID,
  storageBucket: process.env.STORAGE_BUCKET,
  messagingSenderId: process.env.MESSAGING_SENDER_ID,
  appId: process.env.APP_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const app = express();
app.use(express.json());

// 既存のスコア保存API
app.post('/api/scores', async (req, res) => {
  try {
    const { score, userId } = req.body;
    await addDoc(collection(db, 'scores'), {
      score,
      userId,
      timestamp: new Date()
    });
    res.status(200).send('Score saved successfully');
  } catch (error) {
    console.error('Error saving score:', error);
    res.status(500).send('Error saving score');
  }
});

// ▼▼▼ ここから単語取得APIを追加 ▼▼▼
app.post('/api/get-words', async (req, res) => {
  try {
    // クライアントから送られてくるジャンルを取得（指定がなければ 'default' を使用）
    const genre = req.body.genre || 'default'; 
    
    // Firestoreの "words" -> (ジャンル名) -> "details" という階層から単語データを取得
    const wordsCollection = collection(db, 'words', genre, 'details');
    const querySnapshot = await getDocs(wordsCollection);
    
    // 取得したデータから単語（word）だけを抜き出して配列にする
    const words = querySnapshot.docs.map(doc => doc.data().word);
    
    // 単語の配列をJSON形式でクライアントに返す
    res.status(200).json(words);
  } catch (error) {
    console.error('Error fetching words:', error);
    res.status(500).send('Error fetching words');
  }
});
// ▲▲▲ ここまで追加 ▲▲▲


module.exports = app;