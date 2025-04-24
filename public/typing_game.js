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
    
        // 現在の行番号をコンソールに表示（デバッグ用）
        // console.log("現在の行番号:", currentLineIndex);
    
        // カーソルを現在の行の末尾に移動
        let currentLineStart;

        console.log("currentLineIndex:", currentLineIndex);
        if(currentLineIndex === 0) {
            currentLineStart = userInputLines
            .slice(0, currentLineIndex)
            .join("\n").length;// 改行分も加算
        } else {
            currentLineStart = userInputLines
            .slice(0, currentLineIndex)
            // .join("\n").length + currentLineIndex; 
            .join("\n").length + 1;// 改行分も加算
        }

    
        inputField.setSelectionRange(currentLineStart, currentLineStart);
        inputField.focus();
    }
    

    function checkInput(event) {
        const cursorPosition = inputField.selectionStart;

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
        
            // 誤った入力の場合、最後の1文字を削除
            userInputLines[currentLineIndex] = currentInput.slice(0, -1);
            inputField.value = userInputLines.join("\n");
        
            // カーソルを元に戻す
            inputField.setSelectionRange(cursorPosition - 1, cursorPosition - 1);
        
            // currentLineIndexを更新
            currentLineIndex = Math.min(currentLineIndex, allInput.length - 1);
        }
    }

    // 🔽 Enterキーでのみ次の行へ進む
    // TODO: 入力途中にエンターキーを押しても反応しないようにする
    inputField.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault(); // 自動改行を防ぐ
        
            const allInput = inputField.value.replace(/\n$/, "").split("\n");
            const currentInput = allInput[currentLineIndex] || "";
        
            if (currentInput.trim() !== "") { // currentInputが空文字列でない場合
                const targetLine = codeLines[currentLineIndex];
        
                // console.log("入力した行番号:", currentLineIndex);
                // console.log("currentInput:", currentInput);
                // console.log("targetLine:", targetLine);
        
                currentLineIndex++; // 常にcurrentLineIndexを更新
                // console.log("currentLineIndex:", currentLineIndex);
                // console.log("targetLine:", targetLine);
        
                if (currentLineIndex < codeLines.length) {
                    updateInputField(); // プレースホルダーに合わせて入力欄を更新
                } else {
                    endGame();
                }
            } else {
                console.log("currentInputが空です。");
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
    // <script src="https://www.gstatic.com/firebasejs/8.5.0/firebase-auth.js"></script>
});
