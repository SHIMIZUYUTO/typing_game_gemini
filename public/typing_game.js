document.addEventListener("DOMContentLoaded", () => {
    const startButton = document.getElementById("start-button"); // スタートボタン
    const wordDisplay = document.getElementById("word-display"); // 現在の単語
    const inputField = document.getElementById("input-field"); // 入力欄 
    const resultDisplay = document.getElementById("result-display"); // 結果表示
    const incorrectKeysDisplay = document.getElementById("incorrect-keys-display"); // 間違ったキー表示

    let words = [];
    let currentWordIndex = 0;
    let incorrectKeys = {};
    let startTime;

    async function fetchWords() { // Gemini APIから単語のリストを取得
        try {
            const response = await fetch("/get-words", { method: "POST" });
            const data = await response.json();
            words = data.words;
        } catch (error) { // エラーが発生した場合、デフォルトの単語リストを使用
            console.error("Error fetching words:", error);
            words = ["apple", "banana", "cherry", "dog", "elephant", "pineapple", "orange", "grape", "kiwi", "lemon"];
        }
    }

    function updateWord() { // 次の単語を表示
        if (currentWordIndex < words.length) {
            wordDisplay.textContent = words[currentWordIndex];
            inputField.value = "";
            inputField.focus();
        } else {
            endGame();
        }
    }

    function checkInput(event) {
        const targetWord = words[currentWordIndex];
        const input = inputField.value;
        const correctChar = targetWord[input.length - 1]; 

        if (targetWord.startsWith(input)) { // 正しく入力された場合、そのまま継続
            if (input === targetWord) {
                currentWordIndex++;
                updateWord();
            }
        } else { // 間違った場合、correctCharをキーとしてincorrectKeysに追加
            if (correctChar) {
                incorrectKeys[correctChar] = (incorrectKeys[correctChar] || 0) + 1; 
                updateIncorrectKeysDisplay();
            }
            inputField.value = input.slice(0, -1); // 最後の文字を削除して戻す
        }
    }

    function updateIncorrectKeysDisplay() {
        incorrectKeysDisplay.innerHTML = ""; // 一度リセット
        Object.entries(incorrectKeys).forEach(([key, count]) => {
            const keyElement = document.createElement("span");
            keyElement.textContent = `${key}: ${count} `;
            incorrectKeysDisplay.appendChild(keyElement);
        });
    }

    function startGame() {
        inputField.disabled = false;
        startButton.disabled = true;
        resultDisplay.textContent = "";
        startTime = Date.now();
        currentWordIndex = 0;
        incorrectKeys = {};
        incorrectKeysDisplay.innerHTML = "";
        fetchWords().then(() => updateWord());
    }

    function endGame() {
        inputField.disabled = true;
        const timeTaken = (Date.now() - startTime) / 1000;
        const penalty = Object.values(incorrectKeys).reduce((a, b) => a + b, 0);
        const score = 100 - timeTaken - penalty * 2;

        resultDisplay.textContent = `ゲーム終了！スコア: ${Math.max(0, Math.round(score))}`;
        startButton.disabled = false;
    }

    startButton.addEventListener("click", startGame);
    inputField.addEventListener("input", checkInput);
});
