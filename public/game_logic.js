import { getHighScore, saveHighScore, getTopMistakeKeys, saveTopMistakeKeys } from './firebase_helper.js';

export function setupGameEvents() {
    // ボタンイベント登録例
    document.getElementById("start-button").addEventListener("click", startGame);
    document.getElementById("custom-button").addEventListener("click", startCustomGame);
    document.getElementById("stop-button").addEventListener("click", endGame);
    // ...他のイベント
}

// ゲーム開始
export function startGame() {
    // ゲーム初期化・開始処理
}

// カスタムゲーム開始
export async function startCustomGame() {
    // FirebaseからtopMistakeKeys取得→問題取得→ゲーム開始
}

// ゲーム終了
export function endGame() {
    // 終了処理・スコア保存
}

// その他、checkInputやupdateInputFieldなどもここにまとめてexport