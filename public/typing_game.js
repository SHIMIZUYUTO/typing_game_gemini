// TODO: 2回目以降のタイピングゲームの題材出力の実装

document.addEventListener("DOMContentLoaded", () => {
  const startButton = document.getElementById("start-button");
  const stopButton = document.getElementById("stop-button"); // デバッグ用
  const inputField = document.getElementById("input-field");
  const resultDisplay = document.getElementById("result-display");
  const incorrectKeysDisplay = document.getElementById("incorrect-keys-display");
  const diffButton = document.getElementById("diff-button"); // 追加
  const closeDiffBtn = document.getElementById("close-diff");

  let codeLines = [];
  let userInputLines = [];
  let currentLineIndex = 0;
  let incorrectKeys = {};
  let startTime;
  let highScore = 0;
  let mistakeFlags = []; // [行][列]ごとにミス済みかどうか

  // Firebaseをインポート
  import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js').then(({ getAuth }) => {
    import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js').then(({ getFirestore, doc, getDoc, setDoc }) => {
      
      const auth = getAuth();
      const db = getFirestore();

      async function fetchWords() {
          try {
              const response = await fetch("/get-words", { method: "POST" });
              const data = await response.json();
              codeLines = data.codeSnippets || [];
              userInputLines = Array(codeLines.length).fill("");

              // プレースホルダー用Monaco Editorに表示
              if (window.placeholderEditor) {
                  window.placeholderEditor.setValue(codeLines.join("\n"));
              }
          } catch (error) {
              console.error("Error fetching words:", error);
          }
      }

      function updateInputField() {
          window.editor.setValue(userInputLines.join("\n"));

          // カーソル位置を現在の行の先頭に移動
          window.editor.setPosition({ lineNumber: currentLineIndex + 1, column: 1 });
          window.editor.focus();
      }

      function resetMistakeFlags() {
        mistakeFlags = codeLines.map(line => Array(line.length).fill(false));
    }

      function checkInput() {
    const allInput = window.editor.getValue().split("\n");
    for (let i = 0; i < codeLines.length; i++) {
        const currentInput = allInput[i] || "";
        const targetLine = codeLines[i] || "";

        // 各文字ごとに判定
        for (let j = 0; j < targetLine.length; j++) {
            // 入力が足りていない場合はスキップ
            if (j >= currentInput.length) {
                // 入力が戻ってきた場合はフラグをリセット
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
                incorrectKeys[expectedChar] = (incorrectKeys[expectedChar] || 0) + 1;
                updateIncorrectKeysDisplay();
                mistakeFlags[i][j] = true;
                // console.log(`行${i + 1}の${j + 1}文字目 "${expectedChar}" を "${currentInput[j]}" と間違えました。`);
            }
        }
        // 入力が正しい部分はuserInputLinesを更新
        if (targetLine.startsWith(currentInput)) {
            userInputLines[i] = currentInput;
        }
    }
}

      inputField.addEventListener("keydown", (event) => {
        //   if (event.key === "Enter") {
        //       event.preventDefault();
        //       const allInput = inputField.value.replace(/\n$/, "").split("\n");
        //       const currentInput = allInput[currentLineIndex] || "";

        //       if (currentInput.trim() !== "") {
        //           currentLineIndex++;
        //           if (currentLineIndex < codeLines.length) {
        //               updateInputField();
        //           } else {
        //               endGame();
        //           }
        //       }
        //   }
      });

      function updateIncorrectKeysDisplay() {
          incorrectKeysDisplay.innerHTML = "";
          Object.entries(incorrectKeys).forEach(([key, count]) => {
              const keyElement = document.createElement("span");
              keyElement.textContent = `${key}: ${count}回　 `;
              incorrectKeysDisplay.appendChild(keyElement);
          });
      }

      async function startGame() {
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
                  const userDocRef = doc(db, 'users', user.uid);
                  const userDocSnap = await getDoc(userDocRef);

                  if (userDocSnap.exists()) {
                      const userData = userDocSnap.data();
                      highScore = userData.highScore || 0;
                      resultDisplay.textContent = `あなたのハイスコア: ${highScore} 点`;
                  } else {
                      highScore = 0;
                      resultDisplay.textContent = `まだハイスコアはありません！`;
                  }
              }
          } catch (error) {
              console.error('ハイスコア取得エラー:', error);
          }

          fetchWords().then(() => {
              updateInputField();
              resetMistakeFlags();
          });
      }

      async function endGame() {
    inputField.disabled = true;
    const timeTaken = (Date.now() - startTime) / 1000;
    const penalty = Object.values(incorrectKeys).reduce((a, b) => a + b, 0);
    const score = Math.max(0, Math.round(100 - timeTaken - penalty * 2));

    resultDisplay.textContent = `ゲーム終了！スコア: ${score}`;
    startButton.disabled = false;
    customButton.disabled = false;

    // 🔥 ハイスコア更新処理
    try {
        const user = auth.currentUser;
        if (user) {
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                const previousHighScore = userData.highScore || 0;

                if (score > previousHighScore) {
                    await setDoc(userDocRef, {
                        highScore: score
                    }, { merge: true });
                    console.log('ハイスコアを更新しました！');
                } else {
                    console.log('ハイスコアは更新されませんでした');
                }
            }

            // 🔥 間違いカウント上位8つのキーを保存
            // 1. incorrectKeysを配列に変換し、回数で降順ソート
            const sortedKeys = Object.entries(incorrectKeys)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([key]) => key);

            // すべての間違いカウントが0の場合は保存しない
            const allZero = Object.values(incorrectKeys).every(count => count === 0);

            if (!allZero && sortedKeys.length > 0) {
                await setDoc(userDocRef, {
                    topMistakeKeys: sortedKeys
                }, { merge: true });
                console.log('上位8つの間違いキーを保存しました:', sortedKeys);
            } else {
                console.log('間違いカウントが全て0なのでFirebaseは更新しません');
            }
        }
    } catch (error) {
        console.error('ハイスコア更新中にエラー:', error);
    }
}

      // 差分取得＆表示
      diffButton.addEventListener("click", () => {
        if (!window.placeholderEditor || !window.editor) return;

        const original = window.placeholderEditor.getValue();
        const modified = window.editor.getValue();

        const diffContainer = document.getElementById("diff-container");
        diffButton.disabled = true;
        closeDiffBtn.disabled = false;
        diffContainer.style.display = "block";

        // すでにDiffエディタが存在する場合は破棄
        if (window.diffEditor) {
            window.diffEditor.dispose();
        }

        // モデル作成
        const originalModel = window.monaco.editor.createModel(original, "c");
        const modifiedModel = window.monaco.editor.createModel(modified, "c");

        // Diffエディタ生成
        window.diffEditor = window.monaco.editor.createDiffEditor(diffContainer, {
            theme: "vs",
            fontSize: 16,
            readOnly: true,
            automaticLayout: true,
            minimap: { enabled: false }
        });

        window.diffEditor.setModel({
            original: originalModel,
            modified: modifiedModel
        });

        // closeDiffBtn.style.display = "block";
      });

      // 閉じるボタン
      closeDiffBtn.addEventListener("click", () => {
        const diffContainer = document.getElementById("diff-container");
        diffButton.disabled = false;
        closeDiffBtn.disabled = true;
        diffContainer.style.display = "none";
        // closeDiffBtn.style.display = "none";
        if (window.diffEditor) {
            window.diffEditor.dispose();
            window.diffEditor = null;
        }
      });

      startButton.addEventListener("click", startGame);
      stopButton.addEventListener("click", endGame); // デバッグ用
      inputField.addEventListener("input", checkInput);

      // 一旦コメントアウト（削除せずにとっておく）
    //   window.editor.onDidChangeModelContent(() => {
    //     checkInput();
    //   });

    const customButton = document.getElementById("custom-button");

    customButton.addEventListener("click", async () => {
        // FirebaseからtopMistakeKeysを取得
        const user = auth.currentUser;
        if (!user) return alert("ログインしてください");
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        let topMistakeKeys = [];
        if (userDocSnap.exists()) {
            topMistakeKeys = userDocSnap.data().topMistakeKeys || [];
        }

        // サーバーにtopMistakeKeysを送って問題取得
        const response = await fetch("/get-words", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topMistakeKeys })
        });
        const data = await response.json();
        codeLines = data.codeSnippets || [];
        // userInputLinesを模範解答の行数と合わせた配列で初期化（改行を含む状態）
        userInputLines = Array(codeLines.length).fill("");
        
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
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    highScore = userData.highScore || 0;
                    resultDisplay.textContent = `あなたのハイスコア: ${highScore} 点`;
                } else {
                    highScore = 0;
                    resultDisplay.textContent = `まだハイスコアはありません！`;
                }
            }
        } catch (error) {
            console.error('ハイスコア取得エラー:', error);
        }
        
        // ミスフラグのリセット
        mistakeFlags = codeLines.map(line => Array(line.length).fill(false));
        updateInputField();
    });
    });
  });
});
