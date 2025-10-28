import { getHighScore, saveHighScore, getTopMistakeKeys, saveTopMistakeKeys, saveUserTypingSpeed, addTypingSession, updateAverageSpeedIfNeeded, updateDailyAverageSpeed, saveUserProgram, getUserPrograms, toggleFavoriteProgram, getProgramMessages, addProgramMessage, deleteProgramMessage } from './firebase_helper.js';
import { auth } from './firebase_auth.js';

// Main Buttons
let startButton, stopButton, customButton, refactorPracticeButton, diffButton, closeDiffBtn, startShortcutPracticeButton, backToStartMenuFromTyping;

// Main UI Elements
let incorrectKeysDisplay;

// Comment Evaluation UI
let startCommentingButton, submitEvaluationButton, reevaluateButton, evaluationResultModal, evaluationResultContent, closeEvaluationResultButton, submitEvalCell, reevaluateCell;

// Diff Editor UI
let showDiffButton, diffEditorModal, closeDiffModal;

// Result Modal UI
let resultModal, closeResultModal, resultModalScore, resultModalBreakdown, resultModalSpeed, resultModalAccuracy, resultModalMistakes;

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
let diffEditor = null;
let mouseMoveCount = 0;
let editorMouseListener = null;
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

function initializeDOMElements() {
    // Main Buttons
    startButton = document.getElementById("start-button");
    stopButton = document.getElementById("stop-button");
    customButton = document.getElementById("custom-button");
    refactorPracticeButton = document.getElementById("refactor-practice-button");
    startShortcutPracticeButton = document.getElementById('start-shortcut-practice-button');
    diffButton = document.getElementById("diff-button");
    closeDiffBtn = document.getElementById("close-diff");
    backToStartMenuFromTyping = document.getElementById("back-to-start-menu-from-typing");

    // Main UI Elements
    incorrectKeysDisplay = document.getElementById("incorrect-keys-display");

    // Comment Evaluation UI
    startCommentingButton = document.getElementById('start-commenting-button');
    submitEvaluationButton = document.getElementById('submit-evaluation-button');
    reevaluateButton = document.getElementById('reevaluate-button');
    submitEvalCell = document.getElementById('submit-eval-cell');
    reevaluateCell = document.getElementById('reevaluate-cell');
    evaluationResultModal = document.getElementById('evaluation-result-modal');
    evaluationResultContent = document.getElementById('evaluation-result-content');
    closeEvaluationResultButton = document.getElementById('close-evaluation-result-button');

    // Diff Editor UI
    showDiffButton = document.getElementById('show-diff-button');
    diffEditorModal = document.getElementById('diff-editor-modal');
    closeDiffModal = document.getElementById('close-diff-modal');

    // Result Modal UI
    resultModal = document.getElementById('result-modal');
    closeResultModal = document.getElementById('close-result-modal');
    resultModalScore = document.getElementById('result-modal-score');
    resultModalBreakdown = document.getElementById('result-modal-breakdown');
    resultModalSpeed = document.getElementById('result-modal-speed');
    resultModalAccuracy = document.getElementById('result-modal-accuracy');
    resultModalMistakes = document.getElementById('result-modal-mistakes');
}

// Initial setup
export function setupGameEvents() {
    initializeDOMElements(); // Initialize all DOM elements safely

    // Game buttons
    if (startButton) startButton.addEventListener("click", startGame);
    if (customButton) customButton.addEventListener("click", startCustomGame);
    if (refactorPracticeButton) refactorPracticeButton.addEventListener("click", startRefactorGame);
    if (startShortcutPracticeButton) startShortcutPracticeButton.addEventListener("click", startRefactorGame);
    if (stopButton) stopButton.addEventListener("click", handleStopButtonClick);

    // Commenting buttons
    if (startCommentingButton) startCommentingButton.addEventListener('click', () => {
        resultModal.style.display = 'none'; // Hide result modal
        enableCommenting();
    });
    if (submitEvaluationButton) submitEvaluationButton.addEventListener('click', evaluateComments);
    if (reevaluateButton) reevaluateButton.addEventListener('click', enableReevaluation);
    if (closeEvaluationResultButton) closeEvaluationResultButton.addEventListener('click', () => evaluationResultModal.style.display = 'none');

    // Diff editor buttons
    if (showDiffButton) showDiffButton.addEventListener('click', showDiff);
    if (closeDiffModal) closeDiffModal.addEventListener('click', () => diffEditorModal.style.display = 'none');

    // Result modal buttons
    if (closeResultModal) closeResultModal.addEventListener('click', () => {
        resultModal.style.display = 'none';
        // Reset modal for typing game
        resultModalSpeed.style.display = 'block';
        resultModalAccuracy.style.display = 'block';
        resultModalMistakes.style.display = 'block';
        document.getElementById('start-commenting-button').style.display = 'block';
        document.querySelector('#result-modal h2').textContent = '結果発表！';
        const scoreLabel = document.querySelector('#result-modal .score-label');
        if(scoreLabel) scoreLabel.textContent = 'SCORE';
    });

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
}

// --- Typing Game Flow ---

async function startGame() {
    if (backToStartMenuFromTyping) backToStartMenuFromTyping.disabled = true;
    currentGameMode = 'typing';
    await setupNewGame();
    const customTheme = document.getElementById("custom-theme-input").value.trim();
    await fetchWords(customTheme);
    resetGameState();
    if (contentChangeListener) contentChangeListener.dispose();
    contentChangeListener = window.editor.onDidChangeModelContent(checkInput);
}

async function startCustomGame() {
    if (backToStartMenuFromTyping) backToStartMenuFromTyping.disabled = true;
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
    if (startButton) startButton.disabled = true;
    if (customButton) customButton.disabled = true;
    if (refactorPracticeButton) refactorPracticeButton.disabled = true;
    if (stopButton) stopButton.disabled = false;
    if (showDiffButton) showDiffButton.disabled = false;
    
    // Reset and hide comment evaluation controls
    if (submitEvalCell) submitEvalCell.style.display = 'none';
    if (reevaluateCell) reevaluateCell.style.display = 'none';

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

    if (stopButton) stopButton.disabled = true;
    if (startButton) startButton.disabled = false;
    if (customButton) customButton.disabled = false;
    if (refactorPracticeButton) refactorPracticeButton.disabled = false;
    if (showDiffButton) showDiffButton.disabled = true;
    if (backToStartMenuFromTyping) backToStartMenuFromTyping.disabled = false;

    if (wasStoppedManually) {
        // Game was stopped manually, just hide the typing container and show the start menu.
        document.getElementById('typing-container').style.display = 'none';
        document.getElementById('typing-start-menu').style.display = 'flex';
    } else {
        // Game finished normally, populate and show the result modal
        const timeTaken = (Date.now() - startTime) / 1000;
        const totalChars = codeLines.join('\n').length;
        const totalMistakes = Object.values(incorrectKeys).reduce((sum, count) => sum + count, 0);
        const correctlyTypedChars = Math.max(0, totalChars - totalMistakes);
        const accuracy = totalChars > 0 ? correctlyTypedChars / totalChars : 0;

        const baseScore = (correctlyTypedChars / timeTaken) * 100;
        const accuracyBonus = Math.pow(accuracy, 2);
        const score = Math.round(baseScore * accuracyBonus);
        const typingSpeed = (correctlyTypedChars / timeTaken).toFixed(2);

        resultModalScore.textContent = score;
        resultModalBreakdown.textContent = `(スピードスコア: ${Math.round(baseScore)} × スコア倍率: ${accuracyBonus.toFixed(2)})`;
        resultModalSpeed.textContent = `打鍵速度: ${typingSpeed} 回/秒`;

        // Display accuracy and top mistakes
        const accuracyPercent = (accuracy * 100).toFixed(1);
        resultModalAccuracy.textContent = `精度: ${accuracyPercent}%`;

        const sortedMistakes = Object.entries(incorrectKeys).sort(([, a], [, b]) => b - a).slice(0, 5);
        if (sortedMistakes.length > 0) {
            const mistakesHtml = sortedMistakes.map(([key, count]) => `<span>「${key === ' ' ? 'Space' : key}」: ${count}回</span>`).join(' ');
            resultModalMistakes.innerHTML = `<b>主なミス:</b> ${mistakesHtml}`;
        } else {
            resultModalMistakes.textContent = 'ミスはありませんでした！🎉';
        }

        resultModal.style.display = 'flex';

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
            await updateDailyAverageSpeed(user, parseFloat(typingSpeed));
        }
    }
}

// --- Refactor Practice Game Flow ---

async function startRefactorGame() {
    if (backToStartMenuFromTyping) backToStartMenuFromTyping.disabled = true;
    currentGameMode = 'refactor';
    await setupNewGame();
    // resultDisplay.textContent = "お題を生成中...";

    mouseMoveCount = 0;
    editorMouseListener = () => { mouseMoveCount++; };
    window.editor.getDomNode().addEventListener('mousedown', editorMouseListener);

    try {
        const response = await fetch("/api/get-refactor-puzzle", { method: "POST" });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'お題の取得に失敗しました。');
        }
        const puzzle = await response.json();

        // Display hints
        const hintsContainer = document.getElementById('shortcut-hints');
        if (puzzle.hints && puzzle.hints.length > 0) {
            const hintsHtml = puzzle.hints.map((hint, index) => 
                `<div>${index + 1}. ${hint.name} (<b>${hint.keys}</b>)</div>`
            ).join('');
            hintsContainer.innerHTML = `<b>ヒント:</b><br>${hintsHtml}`;
            hintsContainer.style.display = 'block';
        } else {
            hintsContainer.style.display = 'none';
        }

        window.placeholderEditor.setValue(puzzle.correctCode);
        window.editor.setValue(puzzle.scrambledCode);
        window.editor.focus();
        // resultDisplay.textContent = "左のコードと同じになるように、右のコードを編集してください。";
        
        if (contentChangeListener) contentChangeListener.dispose();
        contentChangeListener = window.editor.onDidChangeModelContent(checkRefactorCompletion);

    } catch (error) {
        // resultDisplay.textContent = `エラー: ${error.message}`;
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

    // マウスリスナーの解除
    if (editorMouseListener) {
        window.editor.getDomNode().removeEventListener('mousedown', editorMouseListener);
        editorMouseListener = null;
    }

    // Hide hints
    document.getElementById('shortcut-hints').style.display = 'none';

    const timeTaken = (Date.now() - startTime) / 1000;
    if (!wasStoppedManually) {
        let mouseMessage = '';
        if (mouseMoveCount > 0) {
            mouseMessage = `\nカーソル操作：${mouseMoveCount}回　できるだけホームポジションから手を離さないようにしよう！`;
        } else {
            mouseMessage = `\nカーソル操作：0回　その調子！`;
        }
        // Show result modal for refactor game
        resultModalScore.textContent = `${timeTaken.toFixed(2)}秒`;
        resultModalBreakdown.innerHTML = mouseMessage.replace(/\n/g, '<br>');

        // Hide irrelevant fields and change labels
        resultModalSpeed.style.display = 'none';
        resultModalAccuracy.style.display = 'none';
        resultModalMistakes.style.display = 'none';
        document.getElementById('start-commenting-button').style.display = 'none';
        document.querySelector('#result-modal h2').textContent = '結果発表！';
        const scoreLabel = document.querySelector('#result-modal .score-label');
        if(scoreLabel) scoreLabel.textContent = 'TIME';

        resultModal.style.display = 'flex';
    } else {
        // No action needed, the game is just stopped.
    }

    window.editor.updateOptions({ readOnly: true });
    if (stopButton) stopButton.disabled = true;
    if (startButton) startButton.disabled = false;
    if (customButton) customButton.disabled = false;
    if (refactorPracticeButton) refactorPracticeButton.disabled = false;
    if (showDiffButton) showDiffButton.disabled = true;
    if (backToStartMenuFromTyping) backToStartMenuFromTyping.disabled = false;
}
// --- Diff Flow ---
function showDiff() {
    if (!window.placeholderEditor || !window.editor) return;

    const originalModel = window.placeholderEditor.getModel();
    const modifiedModel = window.editor.getModel();

    if (!diffEditor) {
        diffEditor = monaco.editor.createDiffEditor(document.getElementById('diff-editor-container'), {
            originalEditable: false,
            readOnly: true,
            automaticLayout: true
        });
    }

    diffEditor.setModel({
        original: originalModel,
        modified: modifiedModel
    });

    diffEditorModal.style.display = 'block';
}


// --- Comment Evaluation Flow ---

function enableCommenting() {
    window.editor.updateOptions({ readOnly: false });
    submitEvalCell.style.display = 'inline';
    reevaluateCell.style.display = 'none';
    Toastify({ text: "プログラムにコメントを追記して、「評価を実行」ボタンを押してください。", duration: 4000, gravity: "top", position: "center", style: { background: "#007acc" } }).showToast();
    window.editor.focus();
}

function enableReevaluation() {
    window.editor.updateOptions({ readOnly: false });
    reevaluateCell.style.display = 'none';
    submitEvalCell.style.display = 'inline';
    Toastify({ text: "再度コメントを修正し、「評価を実行」ボタンを押してください。", duration: 4000, gravity: "top", position: "center", style: { background: "#007acc" } }).showToast();
    window.editor.focus();
}

async function evaluateComments() {
    submitEvaluationButton.disabled = true;
    submitEvaluationButton.textContent = '評価中...';
    window.editor.updateOptions({ readOnly: true });

    const codeWithComments = window.editor.getValue();

    try {
        const response = await fetch("/api/evaluate-comments", {
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
        submitEvalCell.style.display = 'none';
        reevaluateCell.style.display = 'inline';
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
        const response = await fetch("/api/get-words", {
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
