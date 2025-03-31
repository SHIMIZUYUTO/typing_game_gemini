document.addEventListener("DOMContentLoaded", () => {
    const startButton = document.getElementById("start-button"); 
    const inputField = document.getElementById("input-field");  
    const resultDisplay = document.getElementById("result-display"); 
    const incorrectKeysDisplay = document.getElementById("incorrect-keys-display"); 

    let codeLines = [];
    let currentLineIndex = 0;
    let incorrectKeys = {};
    let startTime;

    async function fetchWords() {
        try {
            const response = await fetch("/get-words", { method: "POST" });
            const data = await response.json();
            codeLines = data.codeSnippets || [];
    
            // プレースホルダーとして全体のコードを表示（改行対応）
            inputField.setAttribute("placeholder", codeLines.join("\n"));
            inputField.value = codeLines.join("\n"); // 実際の値も改行付きに
        } catch (error) {
            console.error("Error fetching words:", error);
        }
    }
    
    function updateLine() {
        if (currentLineIndex < codeLines.length) {
            inputField.value = "";  // ユーザー入力をリセット
            inputField.focus();
        } else {
            endGame();
        }
    }

    function checkInput(event) {
        const targetLine = codeLines[currentLineIndex];
        const input = inputField.value;
        const correctChar = targetLine[input.length - 1];

        if (targetLine.startsWith(input)) {
            if (input === targetLine) {
                currentLineIndex++;
                updateLine();
            }
        } else {
            if (correctChar) {
                incorrectKeys[correctChar] = (incorrectKeys[correctChar] || 0) + 1;
                updateIncorrectKeysDisplay();
            }
            inputField.value = input.slice(0, -1);
        }
    }

    function updateIncorrectKeysDisplay() {
        incorrectKeysDisplay.innerHTML = "";
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
        incorrectKeys = {};
        incorrectKeysDisplay.innerHTML = "";
        currentLineIndex = 0;
        startTime = Date.now();

        fetchWords().then(() => updateLine());
    }

    function endGame() {
        inputField.disabled = true;
        const timeTaken = (Date.now() - startTime) / 1000;
        const penalty = Object.values(incorrectKeys).reduce((a, b) => a + b, 0);
        const score = Math.max(0, Math.round(100 - timeTaken - penalty * 2));

        resultDisplay.textContent = `ゲーム終了！スコア: ${score}`;
        startButton.disabled = false;
    }

    startButton.addEventListener("click", startGame);
    inputField.addEventListener("input", checkInput);
});
