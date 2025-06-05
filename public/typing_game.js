// TODO: 間違いカウントを一度だけ行うようにする

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

            // 正しい部分のフラグをリセット
            for (let j = 0; j < Math.min(currentInput.length, targetLine.length); j++) {
                if (currentInput[j] === targetLine[j] && mistakeFlags[i][j]) {
                    mistakeFlags[i][j] = false;
                }
            }

            if (targetLine.startsWith(currentInput)) {
                userInputLines[i] = currentInput;
            } else {
                let wrongIndex = 0;
                while (
                    wrongIndex < currentInput.length &&
                    wrongIndex < targetLine.length &&
                    currentInput[wrongIndex] === targetLine[wrongIndex]
                ) {
                    wrongIndex++;
                }
                while (wrongIndex < targetLine.length && targetLine[wrongIndex] === "\t") {
                    wrongIndex++;
                }
                const expectedChar = targetLine[wrongIndex];
                const wrongChar = currentInput[wrongIndex];

                // 間違って入力されたキーが閉じ括弧もしくは"ならスキップ
                if (wrongChar === "}" || wrongChar === ")" || wrongChar === "]" || wrongChar === ">" || wrongChar === '"' || wrongChar === "'") {
                    continue;
                }

                // すでにこの位置でミスカウント済みならスキップ
                if (mistakeFlags[i][wrongIndex]) {
                    continue;
                }

                if (expectedChar) {
                    incorrectKeys[expectedChar] = (incorrectKeys[expectedChar] || 0) + 1;
                    updateIncorrectKeysDisplay();
                    mistakeFlags[i][wrongIndex] = true; // この位置をミス済みに
                    // console.log(`行 ${i + 1} の ${wrongIndex + 1}文字目 "${expectedChar}" を "${wrongChar}" と間違えました。`);
                }
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
              keyElement.textContent = `${key}: ${count} `;
              incorrectKeysDisplay.appendChild(keyElement);
          });
      }

      async function startGame() {
          inputField.disabled = false;
          startButton.disabled = true;
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

        closeDiffBtn.style.display = "block";
      });

      // 閉じるボタン
      closeDiffBtn.addEventListener("click", () => {
        const diffContainer = document.getElementById("diff-container");
        diffContainer.style.display = "none";
        closeDiffBtn.style.display = "none";
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
    });
  });
});
