import { getHighScore, saveHighScore, getTopMistakeKeys, saveTopMistakeKeys, saveUserProgram, getUserPrograms, toggleFavoriteProgram, getProgramMessages, addProgramMessage, deleteProgramMessage } from './firebase_helper.js';
import { auth } from './firebase_auth.js';

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
const tabFavorite = document.getElementById("tab-favorite");
const tabNormal = document.getElementById("tab-normal");

let codeLines = [];
let userInputLines = [];
let currentLineIndex = 0;
let incorrectKeys = {};
let startTime;
let highScore = 0;
let mistakeFlags = []; // [行][列]ごとにミス済みかどうか
let lastPrograms = []; // 直近取得した全プログラム
let currentDifficulty = 3; // デフォルト難易度
const difficultyLineCounts = {
    1: 6,
    2: 12,
    3: 18,
    4: 24,
    5: 30
};

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

    stopButton.disabled = true;
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
            lastPrograms = await getUserPrograms(user);

            // デフォルトはお気に入りタブ
            tabFavorite.classList.add("active-tab");
            tabNormal.classList.remove("active-tab");
            renderProgramsList(lastPrograms, true);
        });
    }

    if (tabFavorite) {
        tabFavorite.addEventListener("click", () => {
            tabFavorite.classList.add("active-tab");
            tabNormal.classList.remove("active-tab");
            renderProgramsList(lastPrograms, true);
        });
    }
    if (tabNormal) {
        tabNormal.addEventListener("click", () => {
            tabNormal.classList.add("active-tab");
            tabFavorite.classList.remove("active-tab");
            renderProgramsList(lastPrograms, false);
        });
    }

    if (closeProgramsModal) {
        closeProgramsModal.addEventListener("click", () => {
            programsModal.style.display = "none";
        });
    }

    const difficultyButtons = document.querySelectorAll(".difficulty-button");
    difficultyButtons.forEach(button => {
        button.addEventListener("click", () => {
            currentDifficulty = parseInt(button.dataset.level);
            difficultyButtons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");
            console.log(`難易度を${currentDifficulty}に設定しました`);
        });
    });
}

// ゲーム開始
export async function startGame() {
    await showCountdown();
    // ゲーム初期化・開始処理
    window.editor.updateOptions({ readOnly: false });
    startButton.disabled = true;
    stopButton.disabled = false; 
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

    const customTheme = document.getElementById("custom-theme-input").value.trim();
    await fetchWords(customTheme);
    resetGameState();
}

// カスタムゲーム開始
export async function startCustomGame() {
    await showCountdown();
    // FirebaseからtopMistakeKeysを取得
    const user = auth.currentUser;
    if (!user) return alert("ログインしてください");

    // ここで直接Firestoreを触る必要はない
    let topMistakeKeys = [];
    if (user) {
        topMistakeKeys = await getTopMistakeKeys(user);
    }

    const customTheme = document.getElementById("custom-theme-input").value.trim();
    // topMistakeKeysも渡したい場合
    const lineCount = difficultyLineCounts[currentDifficulty];
    const body = { topMistakeKeys, lineCount };
    if (customTheme) body.customTheme = customTheme;
    const response = await fetch("/get-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
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
    stopButton.disabled = false;
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
    stopButton.disabled = true;
    const timeTaken = (Date.now() - startTime) / 1000; // 秒単位

    const totalChars = codeLines.join('\n').length;
    const incorrectChars = Object.values(incorrectKeys).reduce((a, b) => a + b, 0);
    const correctChars = totalChars - incorrectChars;

    // 新しいスコア計算
    const baseScore = (correctChars / timeTaken) * 100;
    const accuracy = correctChars / totalChars;
    const score = Math.round(baseScore * Math.pow(accuracy, 2));

    // 正しく入力された文字数のみをカウント
    let correctlyTypedChars = 0;
    for (let i = 0; i < mistakeFlags.length; i++) {
        for (let j = 0; j < mistakeFlags[i].length; j++) {
            if (mistakeFlags[i][j] === "correct") {
                correctlyTypedChars++;
            }
        }
    }
    const typingSpeed = (correctlyTypedChars / timeTaken).toFixed(2);

    resultDisplay.textContent = `ゲーム終了！スコア: ${score} | 打鍵速度: ${typingSpeed} 回/秒`;
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

// fetchWordsを修正
export async function fetchWords(customTheme = "") {
    try {
        const lineCount = difficultyLineCounts[currentDifficulty];
        const body = { lineCount };
        if (customTheme) {
            body.customTheme = customTheme;
        }
        const response = await fetch("/get-words", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        console.log('Server response:', data); // サーバーからのレスポンスをログに出力
        if (data.error) {
            throw new Error(data.error);
        }
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

function renderProgramsList(programs, showFavorite) {
    programsList.innerHTML = "";
    const filtered = programs.filter(p => !!p.favorite === showFavorite);
    if (filtered.length === 0) {
        programsList.innerHTML = `<li>${showFavorite ? "お気に入りのプログラムはありません。" : "通常のプログラムはありません。"}</li>`;
        return;
    }
    filtered.forEach((prog, idx) => {
        const li = document.createElement("li");
        li.className = "program-list-item";
        li.innerHTML = `
            <span class="favorite-star${prog.favorite ? " favorited" : ""}" id="favorite-star-${prog.id}">
                ${prog.favorite ? "★" : "☆"}
            </span>
            <pre class="saved-program-code">${prog.code.replace(/</g, "&lt;")}</pre>
        `;
        // プログラムクリックで詳細画面へ
        li.addEventListener("click", (e) => {
            if (e.target.classList.contains("favorite-star")) return;
            openProgramDetailModal(prog);
        });
        // 星クリックでお気に入り切り替え
        setTimeout(() => {
            const star = document.getElementById(`favorite-star-${prog.id}`);
            if (star) {
                star.onclick = async (event) => {
                    event.stopPropagation();
                    try {
                        await toggleFavoriteProgram(auth.currentUser, prog.id, prog.favorite);
                        showProgramsButton.click();
                    } catch (e) {
                        alert(e.message || "お気に入りは3個までです");
                    }
                };
            }
        }, 0);
        programsList.appendChild(li);
    });
}

async function openProgramDetailModal(prog) {
    // モーダル表示
    document.getElementById("program-detail-modal").style.display = "block";
    document.getElementById("detail-program-code").textContent = prog.code;
    // 星の状態
    const star = document.getElementById("detail-favorite-star");
    star.textContent = prog.favorite ? "★" : "☆";
    star.className = "favorite-star" + (prog.favorite ? " favorited" : "");
    star.onclick = async () => {
        try {
            await toggleFavoriteProgram(auth.currentUser, prog.id, prog.favorite);
            // 再取得して状態更新
            const user = auth.currentUser;
            const programs = await getUserPrograms(user);
            const updated = programs.find(p => p.id === prog.id);
            openProgramDetailModal(updated);
            showProgramsButton.click(); // 一覧も更新
        } catch (e) {
            alert(e.message || "お気に入りは3個までです");
        }
    };

    // チャット履歴を取得して表示
    const user = auth.currentUser;
    const messages = await getProgramMessages(user, prog.id);
    const chatHistory = document.getElementById("chat-history");
    chatHistory.innerHTML = "";
    messages.forEach(msg => {
        const div = document.createElement("div");
        div.className = "chat-msg " + (msg.role === "user" ? "chat-user" : "chat-gemini");
        div.innerHTML = `<b>${msg.role === "user" ? "あなた" : "Gemini"}:</b> ${msg.text.replace(/</g, "&lt;").replace(/\n/g, "<br>")}`;
        chatHistory.appendChild(div);
    });
    chatHistory.scrollTop = chatHistory.scrollHeight;

    // 質問欄初期化
    document.getElementById("detail-question-input").value = "";

    // Gemini質問ボタン
    document.getElementById("detail-ask-gemini").onclick = async () => {
        const question = document.getElementById("detail-question-input").value.trim();
        if (!question) return;
        
        // ユーザーの質問をmessagesに追加
        messages.push({ role: "user", text: question });
        await addProgramMessage(user, prog.id, "user", question);

        // 表示を即時反映
        const userDiv = document.createElement("div");
        userDiv.className = "chat-msg chat-user";
        userDiv.innerHTML = `<b>あなた:</b> ${question.replace(/</g, "&lt;").replace(/\n/g, "<br>")}`;
        chatHistory.appendChild(userDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;

        // Geminiに問い合わせ
        const answerDiv = document.createElement("div");
        answerDiv.className = "chat-msg chat-gemini";
        answerDiv.innerHTML = `<b>Gemini:</b> ...回答取得中...`;
        chatHistory.appendChild(answerDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;

        try {
            const res = await fetch("/ask-gemini", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code: prog.code,
                    question: question,
                    history: messages
                })
            });
            const data = await res.json();
            if (data.answer) {
                // Geminiの回答をmessagesに追加
                messages.push({ role: "gemini", text: data.answer });
                await addProgramMessage(user, prog.id, "gemini", data.answer);
                answerDiv.innerHTML = `<b>Gemini:</b> ${data.answer.replace(/</g, "&lt;").replace(/\n/g, "<br>")}`;
            } else {
                answerDiv.innerHTML = `<b>Gemini:</b> 回答が取得できませんでした。`;
            }
        } catch (e) {
            answerDiv.innerHTML = `<b>Gemini:</b> エラーが発生しました。`;
        }
        document.getElementById("detail-question-input").value = "";
        chatHistory.scrollTop = chatHistory.scrollHeight;
    };

    // 履歴削除ボタン
    document.getElementById("clear-chat-history").onclick = async () => {
        if (!confirm("本当にこのプログラムのトーク履歴を削除しますか？")) return;
        // Firestoreから全メッセージを削除
        const user = auth.currentUser;
        for (const msg of messages) {
            // getProgramMessagesの戻り値にidが含まれていない場合は修正が必要
            // ここではid付きで返すようにfirebase_helper.jsを修正
            await deleteProgramMessage(user, prog.id, msg.id);
        }
        // 表示とメモリ上の履歴をクリア
        document.getElementById("chat-history").innerHTML = "";
        messages.length = 0;
    };

    // 閉じるボタン
    document.getElementById("close-program-detail").onclick = () => {
        document.getElementById("program-detail-modal").style.display = "none";
    };
}

// カウントダウン表示
function showCountdown() {
    return new Promise(resolve => {
        let count = 3;
        const countdown = () => {
            if (count > 0) {
                Toastify({
                    text: `${count}`,
                    duration: 1000,
                    gravity: "top",
                    position: "center",
                    background: "#333",
                    stopOnFocus: true,
                }).showToast();
                count--;
                setTimeout(countdown, 1000);
            } else {
                Toastify({
                    text: "スタート！",
                    duration: 1000,
                    gravity: "top",
                    position: "center",
                    background: "#4CAF50",
                    stopOnFocus: true,
                }).showToast();
                resolve();
            }
        };
        countdown();
    });
}
