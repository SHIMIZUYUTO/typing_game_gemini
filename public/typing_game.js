document.addEventListener("DOMContentLoaded", () => {
    const startButton = document.getElementById("start-button");
    const wordDisplay = document.getElementById("word-display");
    const inputField = document.getElementById("input-field");
    const scoreDisplay = document.getElementById("score-display");
    const resultDisplay = document.getElementById("result-display");
    const incorrectKeysDisplay = document.getElementById("incorrect-keys-display");

    let words = [];
    let currentWordIndex = 0;
    let incorrectKeys = {};
    let startTime;

    async function fetchWords() {
        try {
            const response = await fetch("/get-words", { method: "POST" });
            const data = await response.json();
            words = data.words;
        } catch (error) {
            console.error("Error fetching words:", error);
            words = ["apple", "banana", "cherry", "dog", "elephant", "pineapple", "orange", "grape", "kiwi", "lemon"];
        }
    }

    function updateWord() {
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

        if (targetWord.startsWith(input)) {
            if (input === targetWord) {
                currentWordIndex++;
                updateWord();
            }
        } else {
            if (event.data) {
                incorrectKeys[event.data] = (incorrectKeys[event.data] || 0) + 1;
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
