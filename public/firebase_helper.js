// Firebaseのimportはindex.htmlの<script type="module">で初期化済み前提

export async function getHighScore(user) {
    // Firestoreからハイスコア取得
}

export async function saveHighScore(user, score) {
    // Firestoreにハイスコア保存
}

export async function getTopMistakeKeys(user) {
    // FirestoreからtopMistakeKeys取得
}

export async function saveTopMistakeKeys(user, keys) {
    // FirestoreにtopMistakeKeys保存
}