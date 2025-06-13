import { getHighScore, saveHighScore, getTopMistakeKeys, saveTopMistakeKeys, saveUserProgram, getUserPrograms } from './firebase_helper.js';
import { auth, db } from './firebase_auth.js';

const startButton = document.getElementById("start-button");
const stopButton = document.getElementById("stop-button"); // デバッグ用
const inputField = document.getElementById("input-field");
const resultDisplay = document.getElementById("result-display");
const incorrectKeysDisplay = document.getElementById("incorrect-keys-display");
const customButton = document.getElementById("custom-button");
const diffButton = document.getElementById("diff-button"); // 追加
const closeDiffBtn = document.getElementById("close-diff");
const showProgramsButton = document.getElementById("show-programs-button");
const programsModal = document.getElementById("programs-modal");
const closeProgramsModal = document.getElementById("close-programs-modal");
const programsList = document.getElementById("programs-list");

let codeLines = [];
let userInputLines = [];
let currentLineIndex = 0;
let incorrectKeys = {};
let startTime;
let highScore = 0;
let mistakeFlags = []; // [行][列]ごとにミス済みかどうか

export function setupGameEvents() {
    startButton.addEventListener("click", startGame);
    customButton.addEventListener("click", startCustomGame);
    stopButton.addEventListener("click", endGame);

    // 入力欄の内容が変わったらcheckInputを呼ぶ
    if (window.editor) {
        window.editor.onDidChangeModelContent(() => {
            checkInput();
        });
    }

    // 差分ボタンの有効/無効制御とクリック時の処理
    diffButton.disabled = true;
    closeDiffBtn.disabled = true;

    diffButton.addEventListener("click", () => {
        // 差分表示はdiff_view.jsで行うので、ここではボタンの有効/無効だけ管理
        diffButton.disabled = true;
        closeDiffBtn.disabled = false;
    });

    closeDiffBtn.addEventListener("click", () => {
        diffButton.disabled = false;
        closeDiffBtn.disabled = true;
    });

    // 保存されたプログラム表示ボタンの設定
    if (showProgramsButton) {
        showProgramsButton.addEventListener("click", async () => {
            const user = auth.currentUser;
            if (!user) {
                alert("ログインしてください");
                return;
            }
            programsList.innerHTML = "<li>読み込み中...</li>";
            programsModal.style.display = "block";
            const programs = await getUserPrograms(user);
            if (programs.length === 0) {
                programsList.innerHTML = "<li>保存されたプログラムはありません。</li>";
            } else {
                programsList.innerHTML = "";
                programs.forEach((prog, idx) => {
                    const li = document.createElement("li"); // TODO: style.cssに移す
                    li.innerHTML = `
                        <pre class="saved-program-code">${prog.code.replace(/</g, "&lt;")}</pre>
                        <div class="saved-program-date">保存日時: ${prog.savedAt ? new Date(prog.savedAt).toLocaleString() : "不明"}</div>
                        <input type="text" class="program-question-input" placeholder="このプログラムについて質問" id="question-input-${prog.id}">
                        <button class="ask-gemini-btn" id="ask-gemini-${prog.id}">Geminiに質問</button>
                        <div class="gemini-answer" id="gemini-answer-${prog.id}"></div>
                    `;
                    programsList.appendChild(li);

                    // 質問ボタンのイベントリスナーを追加
                    setTimeout(() => {
                        const askBtn = document.getElementById(`ask-gemini-${prog.id}`);
                        const questionInput = document.getElementById(`question-input-${prog.id}`);
                        const answerDiv = document.getElementById(`gemini-answer-${prog.id}`);
                        if (askBtn && questionInput && answerDiv) {
                            // 既存のイベントリスナーを全て削除
                            askBtn.replaceWith(askBtn.cloneNode(true));
                            const newAskBtn = document.getElementById(`ask-gemini-${prog.id}`);
                            newAskBtn.addEventListener("click", async () => {
                                const question = questionInput.value.trim();
                                if (!question) {
                                    answerDiv.textContent = "質問内容を入力してください。";
                                    return;
                                }
                                answerDiv.textContent = "Geminiに問い合わせ中...";
                                try {
                                    // サーバーに質問を送信
                                    const res = await fetch("/ask-gemini", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                            code: prog.code,
                                            question: question
                                        })
                                    });
                                    const data = await res.json();
                                    if (data.answer) {
                                        // 改行を<br>に変換してHTMLとして表示
                                        answerDiv.innerHTML = data.answer.replace(/</g, "&lt;").replace(/\n/g, "<br>");
                                        console.log("Geminiの回答:", data.answer);
                                    } else {
                                        answerDiv.textContent = "回答が取得できませんでした。";
                                    }
                                } catch (e) {
                                    answerDiv.textContent = "エラーが発生しました。";
                                }
                            });
                        }
                    }, 0);
                });
            }
        });
    }

    if (closeProgramsModal) {
        closeProgramsModal.addEventListener("click", () => {
            programsModal.style.display = "none";
        });
    }
}

// ゲーム開始
export async function startGame() {
    // ゲーム初期化・開始処理
    inputField.disabled = false;
    startButton.disabled = true;
    diffButton.disabled = false;
    customButton.disabled = true;
    resultDisplay.textContent = "";
    incorrectKeys = {};
    incorrectKeysDisplay.innerHTML = "";
    currentLineIndex = 0;
    startTime = Date.now();

    // 🔥 ユーザーのハイスコアを取得して表示
    try {
        const user = auth.currentUser;
        if (user) {
            highScore = await getHighScore(user);
            resultDisplay.textContent = `あなたのハイスコア: ${highScore} 点`;
        }
    } catch (error) {
        console.error('ハイスコア取得エラー:', error);
    }

    fetchWords().then(() => {
        resetGameState();
    });
}

// カスタムゲーム開始
export async function startCustomGame() {
    // FirebaseからtopMistakeKeysを取得
    const user = auth.currentUser;
    if (!user) return alert("ログインしてください");

    // ここで直接Firestoreを触る必要はない
    let topMistakeKeys = [];
    if (user) {
        topMistakeKeys = await getTopMistakeKeys(user);
    }

    // サーバーにtopMistakeKeysを送って問題取得
    const response = await fetch("/get-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topMistakeKeys })
    });
    const data = await response.json();
    codeLines = data.codeSnippets || [];

    // ここで一度だけ初期化
    resetGameState();

    // プレースホルダー用Monaco Editorに表示
    if (window.placeholderEditor) {
        window.placeholderEditor.setValue(codeLines.join("\n"));
    }
    // 入力用エディタも模範解答の行数に合わせた改行状態で初期化
    if (window.editor) {
        window.editor.setValue(userInputLines.join("\n"));
    }
    
    // ↓以下、スタートボタンで実施しているゲーム開始処理と同様の処理
    
    // 入力欄を有効にし、スタートボタンを無効化
    inputField.disabled = false;
    startButton.disabled = true;
    diffButton.disabled = false;
    customButton.disabled = true;
    resultDisplay.textContent = "";
    incorrectKeys = {};
    incorrectKeysDisplay.innerHTML = "";
    currentLineIndex = 0;
    startTime = Date.now();
    
    // ユーザーのハイスコアを取得して表示
    try {
        if (user) {
            highScore = await getHighScore(user);
            resultDisplay.textContent = `あなたのハイスコア: ${highScore} 点`;
        }
    } catch (error) {
        console.error('ハイスコア取得エラー:', error);
    }
    
    // ミスフラグのリセット
    mistakeFlags = codeLines.map(line => Array(line.length).fill(false));
    updateInputField();

    // 新しい問題をセットした直後
    incorrectKeys = {};
    updateIncorrectKeysDisplay();
    resetMistakeFlags();
}

// ゲーム終了
export async function endGame() {
    inputField.disabled = true;
    const timeTaken = (Date.now() - startTime) / 1000;
    const penalty = Object.values(incorrectKeys).reduce((a, b) => a + b, 0);
    const score = Math.max(0, Math.round(100 - timeTaken - penalty * 2));

    resultDisplay.textContent = `ゲーム終了！スコア: ${score}`;
    startButton.disabled = false;
    customButton.disabled = false;

    // ハイスコア更新処理
    try {
        const user = auth.currentUser;
        if (user) {
            // ここで現在のハイスコアを取得
            const previousHighScore = await getHighScore(user);

            // スコアがハイスコアを上回った場合のみ保存
            if (score > previousHighScore) {
                await saveHighScore(user, score);
                console.log('ハイスコアを更新しました！');
            } else {
                console.log('ハイスコアは更新されませんでした');
            }
        }

        // 間違いカウント上位8つのキーを保存
        // 1. incorrectKeysを配列に変換し、回数で降順ソート
        const sortedKeys = Object.entries(incorrectKeys)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([key]) => key);

        // すべての間違いカウントが0の場合は保存しない
        const allZero = Object.values(incorrectKeys).every(count => count === 0);

        if (!allZero && sortedKeys.length > 0) {
            await saveTopMistakeKeys(auth.currentUser, sortedKeys);
            console.log('上位8つの間違いキーを保存しました:', sortedKeys);
        } else {
            console.log('間違いカウントが全て0なのでFirebaseは更新されません');
        }

        // プログラムを保存
        try {
            if (user && window.placeholderEditor) { // TODO: window.editorに変更
                const code = window.placeholderEditor.getValue();
                await saveUserProgram(user, code);
                console.log('プログラムを保存しました');
            }
        } catch (error) {
            console.error('プログラム保存エラー:', error);
        }
    } catch (error) {
        console.error('ハイスコア更新中にエラー:', error);
    }
}

export function updateInputField() {
    window.editor.setValue(userInputLines.join("\n"));

    // カーソル位置を現在の行の先頭に移動
    window.editor.setPosition({ lineNumber: currentLineIndex + 1, column: 1 });
    window.editor.focus();
}

export function checkInput() {
    const allInput = window.editor.getValue().split("\n");
    for (let i = 0; i < codeLines.length; i++) {
        const currentInput = allInput[i] || "";
        const targetLine = codeLines[i] || "";
        for (let j = 0; j < targetLine.length; j++) {
            // 入力が足りていない場合はスキップ
            if (j >= currentInput.length) {
                continue;
            }

            // すでに正しい文字が一度でも入力された箇所は今後判定しない
            if (mistakeFlags[i][j] === "correct") {
                continue;
            }

            // 正しい文字が入力されたらフラグを"correct"にして今後判定しない
            if (currentInput[j] === targetLine[j]) {
                mistakeFlags[i][j] = "correct";
                continue;
            }

            // 間違って入力されたキーが閉じ括弧やクォートならスキップ
            if (
                currentInput[j] === "}" || currentInput[j] === ")" ||
                currentInput[j] === "]" || currentInput[j] === ">" ||
                currentInput[j] === '"' || currentInput[j] === "'"
            ) {
                continue;
            }

            // まだカウントしていない場合のみカウント
            if (!mistakeFlags[i][j]) {
                const expectedChar = targetLine[j];
                const inputChar = currentInput[j];
                console.log(`ミスカウント: 行${i} 列${j} 入力[${inputChar}]→正解[${expectedChar}]`);
                incorrectKeys[expectedChar] = (incorrectKeys[expectedChar] || 0) + 1;
                updateIncorrectKeysDisplay();
                mistakeFlags[i][j] = true;
            }
        }
        // 入力が正しい部分はuserInputLinesを更新
        if (targetLine.startsWith(currentInput)) {
            userInputLines[i] = currentInput;
        }
    }
}

export function updateIncorrectKeysDisplay() {
    incorrectKeysDisplay.innerHTML = "";
    Object.entries(incorrectKeys).forEach(([key, count]) => {
        const keyElement = document.createElement("span");
        keyElement.textContent = `${key}: ${count}回　 `;
        incorrectKeysDisplay.appendChild(keyElement);
    });
}

export async function fetchWords() {
    try {
        const response = await fetch("/get-words", { method: "POST" });
        const data = await response.json();
        codeLines = data.codeSnippets || [];
        userInputLines = Array(codeLines.length).fill("");
        if (window.placeholderEditor) {
            window.placeholderEditor.setValue(codeLines.join("\n"));
        }
    } catch (error) {
        console.error("Error fetching words:", error);
    }
}

export function resetMistakeFlags() {
    mistakeFlags = codeLines.map(line => Array(line.length).fill(false));
}

function resetGameState() {
    incorrectKeys = {};
    updateIncorrectKeysDisplay();
    mistakeFlags = codeLines.map(line => Array(line.length).fill(false));
    userInputLines = Array(codeLines.length).fill("");
    updateInputField();
}

// その他、checkInputやupdateInputFieldなどもここにまとめてexport
