import { getHighScore, saveHighScore, getTopMistakeKeys, saveTopMistakeKeys, saveUserTypingSpeed, addTypingSession, updateAverageSpeedIfNeeded, saveUserProgram, getUserPrograms, toggleFavoriteProgram, getProgramMessages, addProgramMessage, deleteProgramMessage } from './firebase_helper.js';
import { auth } from './firebase_auth.js';

// Main Buttons
const startButton = document.getElementById("start-button");
const stopButton = document.getElementById("stop-button");
const customButton = document.getElementById("custom-button");
const refactorPracticeButton = document.getElementById("refactor-practice-button");
const diffButton = document.getElementById("diff-button");
const closeDiffBtn = document.getElementById("close-diff");

// Main UI Elements
const resultDisplay = document.getElementById("result-display");
const incorrectKeysDisplay = document.getElementById("incorrect-keys-display");

// Comment Evaluation UI
const commentControls = document.getElementById('comment-evaluation-controls');
const startCommentingButton = document.getElementById('start-commenting-button');
const submitEvaluationButton = document.getElementById('submit-evaluation-button');
const reevaluateButton = document.getElementById('reevaluate-button');
const evaluationResultModal = document.getElementById('evaluation-result-modal');
const evaluationResultContent = document.getElementById('evaluation-result-content');
const closeEvaluationResultButton = document.getElementById('close-evaluation-result-button');

// Evaluation weights
const evaluationWeights = {
    meaningfulness: 0.3,
    value: 0.2,
    accuracy: 0.2,
    clarity: 0.1,
    density: 0.1,
    style: 0.1
};

// Game State
let isGameEnding = false;
let codeLines = [];
let userInputLines = [];
let mistakeFlags = [];
let incorrectKeys = {};
let startTime;
let currentDifficulty = 3;
const difficultyLineCounts = { 1: 7, 2: 10, 3: 15, 4: 20, 5: 25 };
let currentGameMode = 'typing'; // 'typing' または 'refactor'
let contentChangeListener = null; // disposableリスナーを保持するため

// Initial setup
export function setupGameEvents() {
    // Game buttons
    startButton.addEventListener("click", startGame);
    customButton.addEventListener("click", startCustomGame);
    refactorPracticeButton.addEventListener("click", startRefactorGame);
    stopButton.addEventListener("click", handleStopButtonClick);
    // diffButton.addEventListener('click', showDiff);
    // closeDiffBtn.addEventListener('click', closeDiff);

    // Commenting buttons
    startCommentingButton.addEventListener('click', enableCommenting);
    submitEvaluationButton.addEventListener('click', evaluateComments);
    reevaluateButton.addEventListener('click', enableReevaluation);
    closeEvaluationResultButton.addEventListener('click', () => evaluationResultModal.style.display = 'none');

    // Difficulty buttons
    const difficultyButtons = document.querySelectorAll(".difficulty-button");
    difficultyButtons.forEach(button => {
        button.addEventListener("click", () => {
            currentDifficulty = parseInt(button.dataset.level);
            difficultyButtons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");
        });
    });
    
    // Initial button states
    stopButton.disabled = true;
    // diffButton.disabled = true;
    // closeDiffBtn.disabled = true;
}

// --- Typing Game Flow ---

async function startGame() {
    currentGameMode = 'typing';
    await setupNewGame();
    const customTheme = document.getElementById("custom-theme-input").value.trim();
    await fetchWords(customTheme);
    resetGameState();
    if (contentChangeListener) contentChangeListener.dispose();
    contentChangeListener = window.editor.onDidChangeModelContent(checkInput);
}

async function startCustomGame() {
    currentGameMode = 'typing';
    await setupNewGame();
    const user = auth.currentUser;
    if (!user) return alert("ログインしてください");

    const topMistakeKeys = await getTopMistakeKeys(user);
    const customTheme = document.getElementById("custom-theme-input").value.trim();
    await fetchWords(customTheme, topMistakeKeys);
    resetGameState();
    if (contentChangeListener) contentChangeListener.dispose();
    contentChangeListener = window.editor.onDidChangeModelContent(checkInput);
}

async function setupNewGame() {
    isGameEnding = false; // Reset the flag
    await showCountdown();
    window.editor.updateOptions({ readOnly: false });
    startButton.disabled = true;
    customButton.disabled = true;
    refactorPracticeButton.disabled = true;
    stopButton.disabled = false;
    
    // Reset and hide comment evaluation controls
    commentControls.style.display = 'none';
    startCommentingButton.style.display = 'inline-block';
    submitEvaluationButton.style.display = 'none';
    reevaluateButton.style.display = 'none';

    resultDisplay.textContent = "";
    incorrectKeys = {};
    updateIncorrectKeysDisplay();
    startTime = Date.now();
}

function resetGameState() {
    mistakeFlags = codeLines.map(line => Array(line.length).fill(false));
    userInputLines = Array(codeLines.length).fill("");
    if (window.placeholderEditor) {
        window.placeholderEditor.setValue(codeLines.join("\n"));
    }
    updateInputField();
}

function handleStopButtonClick() {
    if (currentGameMode === 'typing') {
        endGame(true); // 手動での中断を示すためにtrueを渡す
    } else if (currentGameMode === 'refactor') {
        endRefactorGame(true); // 手動での中断を示すためにtrueを渡す
    }
}

async function endGame(wasStoppedManually) {
    if (isGameEnding) return; // Prevent double execution
    isGameEnding = true; // Set the flag

    if (contentChangeListener) contentChangeListener.dispose();
    contentChangeListener = null;

    window.editor.updateOptions({ readOnly: true });
    stopButton.disabled = true;
    startButton.disabled = false;
    customButton.disabled = false;
    refactorPracticeButton.disabled = false;
    
    if (wasStoppedManually) {
        resultDisplay.textContent = "タイピングが中断されたので記録は保存されません。";
        commentControls.style.display = 'none'; 
    } else {
        // 通常の完了処理
        commentControls.style.display = 'block';
        const timeTaken = (Date.now() - startTime) / 1000;
        const totalChars = codeLines.join('\n').length;
        const totalMistakes = Object.values(incorrectKeys).reduce((sum, count) => sum + count, 0);
        const correctlyTypedChars = Math.max(0, totalChars - totalMistakes);
        const accuracy = totalChars > 0 ? correctlyTypedChars / totalChars : 0;

        // デバッグ用に値を出力
        console.log(`Accuracy Debug: totalChars=${totalChars}, correctlyTypedChars=${correctlyTypedChars}, accuracy=${accuracy}`);

        const baseScore = (correctlyTypedChars / timeTaken) * 100;
        const accuracyBonus = Math.pow(accuracy, 2);
        const score = Math.round(baseScore * accuracyBonus);
        const typingSpeed = (correctlyTypedChars / timeTaken).toFixed(2);

        resultDisplay.textContent = `ゲーム終了！スコア: ${score} (スピード: ${Math.round(baseScore)} × スコア倍率: ${accuracyBonus.toFixed(2)}) | 打鍵速度: ${typingSpeed} 回/秒`;

        const user = auth.currentUser;
        if (!user) return;

        if (score > (await getHighScore(user) || 0)) {
            await saveHighScore(user, score);
        }
        const sortedKeys = Object.entries(incorrectKeys).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([key]) => key);
        if (Object.values(incorrectKeys).some(count => count > 0)) {
            await saveTopMistakeKeys(user, sortedKeys);
        }
        await saveUserProgram(user, window.placeholderEditor.getValue());

        if (typingSpeed) {
            await addTypingSession(user, parseFloat(typingSpeed));
            await updateAverageSpeedIfNeeded(user);
        }
    }
}

// --- Refactor Practice Game Flow ---

async function startRefactorGame() {
    currentGameMode = 'refactor';
    await setupNewGame();
    resultDisplay.textContent = "お題を生成中...";

    try {
        const response = await fetch("/get-refactor-puzzle", { method: "POST" });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'お題の取得に失敗しました。');
        }
        const puzzle = await response.json();

        window.placeholderEditor.setValue(puzzle.correctCode);
        window.editor.setValue(puzzle.scrambledCode);
        window.editor.focus();
        resultDisplay.textContent = "左のコードと同じになるように、右のコードを編集してください。";
        
        if (contentChangeListener) contentChangeListener.dispose();
        contentChangeListener = window.editor.onDidChangeModelContent(checkRefactorCompletion);

    } catch (error) {
        resultDisplay.textContent = `エラー: ${error.message}`;
        endRefactorGame(true); // エラー時にゲームを終了
    }
}

function checkRefactorCompletion() {
    if (!window.editor || !window.placeholderEditor) return;
    const editorValue = window.editor.getValue();
    const placeholderValue = window.placeholderEditor.getValue();

    if (editorValue && placeholderValue && editorValue === placeholderValue) {
        endRefactorGame(false);
    }
}

function endRefactorGame(wasStoppedManually) {
    if (contentChangeListener) {
        contentChangeListener.dispose();
        contentChangeListener = null;
    }

    const timeTaken = (Date.now() - startTime) / 1000;
    if (!wasStoppedManually) {
        resultDisplay.textContent = `クリア！ 🎉 かかった時間: ${timeTaken.toFixed(2)}秒`;
    } else {
        resultDisplay.textContent = "ショートカットキー練習を中断しました。";
    }

    window.editor.updateOptions({ readOnly: true });
    stopButton.disabled = true;
    startButton.disabled = false;
    customButton.disabled = false;
    refactorPracticeButton.disabled = false;
}


// --- Diff Flow ---
function showDiff() {
    if (!window.placeholderEditor || !window.editor) return;
    const original = window.placeholderEditor.getValue();
    const modified = window.editor.getValue();
    const diff = window.Diff.createPatch('diff', original, modified);
    // alert(diff); // ユーザーの要望により削除
}

function closeDiff() {}


// --- Comment Evaluation Flow ---

function enableCommenting() {
    window.editor.updateOptions({ readOnly: false });
    startCommentingButton.style.display = 'none';
    submitEvaluationButton.style.display = 'inline-block';
    reevaluateButton.style.display = 'none';
    resultDisplay.textContent = '\nプログラムにコメントを追記して、「評価を実行」ボタンを押してください。';
    window.editor.focus();
}

function enableReevaluation() {
    window.editor.updateOptions({ readOnly: false });
    reevaluateButton.style.display = 'none';
    submitEvaluationButton.style.display = 'inline-block';
    resultDisplay.textContent = '\n再度コメントを修正し、「評価を実行」ボタンを押してください。';
    window.editor.focus();
}

async function evaluateComments() {
    submitEvaluationButton.disabled = true;
    submitEvaluationButton.textContent = '評価中...';
    window.editor.updateOptions({ readOnly: true });

    const codeWithComments = window.editor.getValue();

    try {
        const response = await fetch("/evaluate-comments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codeWithComments })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || '評価に失敗しました。');
        }

        const result = await response.json();
        if (!result.scores) {
            throw new Error('サーバーからの評価データ形式が正しくありません。scoresオブジェクトが含まれていません。');
        }
        displayEvaluationResult(result);

    } catch (error) {
        alert(`エラー: ${error.message}`);
        window.editor.updateOptions({ readOnly: false });
    } finally {
        submitEvaluationButton.disabled = false;
        submitEvaluationButton.textContent = '評価を実行';
        submitEvaluationButton.style.display = 'none';
        reevaluateButton.style.display = 'inline-block';
        startCommentingButton.style.display = 'none';
    }
}

function displayEvaluationResult(result) {
    let weightedScore = 0;
    for (const key in result.scores) {
        if (evaluationWeights.hasOwnProperty(key)) {
            const score = result.scores[key];
            weightedScore += score * evaluationWeights[key];
        }
    }
    const finalScore = Math.round(weightedScore);

    let contentHTML = `<div class="score">あなたの総合スコア: ${finalScore} / 100 点</div>`;
    // contentHTML += `<p style="font-size: 0.8em; color: #666;">(AIによる参考評価: ${result.overallScore} / 100 点)</p>`;
    contentHTML += `<h3>項目別フィードバック</h3>`;
    contentHTML += `<ul>`;
    contentHTML += `<li><b>意味 (貢献度: 30%):</b> <span class="score-value">[${result.scores.meaningfulness}点]</span> ${result.feedback.meaningfulness}</li>`;
    contentHTML += `<li><b>付加価値 (貢献度: 20%):</b> <span class="score-value">[${result.scores.value}点]</span> ${result.feedback.value}</li>`;
    contentHTML += `<li><b>正確性 (貢献度: 20%):</b> <span class="score-value">[${result.scores.accuracy}点]</span> ${result.feedback.accuracy}</li>`;
    contentHTML += `<li><b>明瞭さ (貢献度: 10%):</b> <span class="score-value">[${result.scores.clarity}点]</span> ${result.feedback.clarity}</li>`;
    contentHTML += `<li><b>量 (貢献度: 10%):</b> <span class="score-value">[${result.scores.density}点]</span> ${result.feedback.density}</li>`;
    contentHTML += `<li><b>スタイル (貢献度: 10%):</b> <span class="score-value">[${result.scores.style}点]</span> ${result.feedback.style}</li>`;
    contentHTML += `</ul>`;
    contentHTML += `<h3>全体的なコメント</h3>`;
    contentHTML += `<p>${result.generalComment}</p>`;

    evaluationResultContent.innerHTML = contentHTML;
    evaluationResultModal.style.display = 'flex';
}

// --- Utility Functions ---

function updateInputField() {
    window.editor.setValue(userInputLines.join("\n"));
    window.editor.setPosition({ lineNumber: 1, column: 1 });
    window.editor.focus();
}

function checkInput() {
    if (currentGameMode !== 'typing') return;
    if (window.editor.getOption(monaco.editor.EditorOption.readOnly)) return;
    const allInput = window.editor.getValue().split("\n");
    for (let i = 0; i < codeLines.length; i++) {
        const currentInput = allInput[i] || "";
        const targetLine = codeLines[i] || "";
        for (let j = 0; j < targetLine.length; j++) {
            if (j >= currentInput.length || mistakeFlags[i][j] === "correct") continue;
            if (currentInput[j] === targetLine[j]) {
                mistakeFlags[i][j] = "correct";
                continue;
            }
            if (
                currentInput[j] === "}" || currentInput[j] === ")" ||
                currentInput[j] === "]" || currentInput[j] === ">" ||
                currentInput[j] === '"' || currentInput[j] === "'"
            ) {
                continue;
            }
            if (!mistakeFlags[i][j]) {
                const expectedChar = targetLine[j];
                incorrectKeys[expectedChar] = (incorrectKeys[expectedChar] || 0) + 1;
                updateIncorrectKeysDisplay();
                mistakeFlags[i][j] = true;
            }
        }
    }

    // Check for completion, ignoring trailing whitespace/newlines in user input
    const editorValue = window.editor.getValue();
    const placeholderValue = window.placeholderEditor.getValue();
    if (editorValue.trimEnd() === placeholderValue) {
        // Snap the editor value to the correct one to remove trailing lines.
        if (editorValue !== placeholderValue) {
            window.editor.setValue(placeholderValue);
        }
        // End the game normally
        endGame(false); // 中断せずに完了
    }
}

function updateIncorrectKeysDisplay() {
    incorrectKeysDisplay.innerHTML = "";
    Object.entries(incorrectKeys).forEach(([key, count]) => {
        const keyElement = document.createElement("span");
        const displayKey = key === ' ' ? 'Space' : key;
        keyElement.textContent = `${displayKey}: ${count}回　 `;
        incorrectKeysDisplay.appendChild(keyElement);
    });
}

async function fetchWords(customTheme = "", topMistakeKeys = []) {
    try {
        const lineCount = difficultyLineCounts[currentDifficulty];
        const body = { lineCount, customTheme, topMistakeKeys };
        const response = await fetch("/get-words", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        codeLines = data.codeSnippets || [];
    } catch (error) {
        console.error("Error fetching words:", error);
        codeLines = ["// エラー: 問題の取得に失敗しました。リロードしてください"];
    }
}

function showCountdown() {
    return new Promise(resolve => {
        let count = 3;
        const countdown = () => {
            if (count > 0) {
                Toastify({ text: `${count--}`, duration: 1000, gravity: "top", position: "center" }).showToast();
                setTimeout(countdown, 1000);
            } else {
                Toastify({ text: "スタート！", duration: 1000, gravity: "top", position: "center", style: { background: "#4CAF50" } }).showToast();
                resolve();
            }
        };
        countdown();
    });
}
