document.addEventListener("DOMContentLoaded", () => {
    const startButton = document.getElementById("start-button");
    const inputField = document.getElementById("input-field");
    const resultDisplay = document.getElementById("result-display");
    const incorrectKeysDisplay = document.getElementById("incorrect-keys-display");
    const placeholderField = document.getElementById("placeholder-field");

    let codeLines = [];
    let userInputLines = [];
    let currentLineIndex = 0;
    let incorrectKeys = {};
    let startTime;

    async function fetchWords() {
        try {
            const response = await fetch("/get-words", { method: "POST" });
            const data = await response.json();
            codeLines = data.codeSnippets || [];
            userInputLines = Array(codeLines.length).fill("");

            // プレースホルダー用の表示（背景に表示）
            placeholderField.textContent = codeLines.join("\n");
        } catch (error) {
            console.error("Error fetching words:", error);
        }
    }

    function updateInputField() {
        inputField.value = userInputLines.join("\n");

        // カーソルを現在の行の末尾に移動
        const currentLineStart = userInputLines
            .slice(0, currentLineIndex)
            .join("\n").length + currentLineIndex; // 改行分も加算

        inputField.setSelectionRange(currentLineStart, currentLineStart);
        inputField.focus();
    }

    function checkInput(event) {
        const allInput = inputField.value.split("\n");
        const currentInput = allInput[currentLineIndex] || "";
        const targetLine = codeLines[currentLineIndex];
        const correctChar = targetLine[currentInput.length - 1];
    
        if (targetLine.startsWith(currentInput)) {
            userInputLines[currentLineIndex] = currentInput;
        } else {
            if (correctChar) {
                incorrectKeys[correctChar] = (incorrectKeys[correctChar] || 0) + 1;
                updateIncorrectKeysDisplay();
            }
    
            const selectionStart = inputField.selectionStart;
            userInputLines[currentLineIndex] = currentInput.slice(0, -1);
            inputField.value = userInputLines.join("\n");
    
            const offset = selectionStart - 1;
            inputField.setSelectionRange(offset, offset);
        }
    }
    
    // 🔽 Enterキーでのみ次の行へ進む
    inputField.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault(); // 自動改行を防ぐ
    
            const userInputLines = inputField.value.split("\n"); // 最新の状態を取得
            const currentInput = userInputLines[currentLineIndex] || "";
            const targetLine = codeLines[currentLineIndex];
    
            if (currentInput === targetLine) {
                currentLineIndex++;
    
                if (currentLineIndex < codeLines.length) {
                    updateInputField(); // プレースホルダーに合わせて入力欄を更新
                } else {
                    endGame();
                }
            }
        }
    });
    
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

        fetchWords().then(() => {
            updateInputField();
        });
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
