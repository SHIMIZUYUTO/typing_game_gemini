document.addEventListener("DOMContentLoaded", () => {
  const startButton = document.getElementById("start-button");
  const inputField = document.getElementById("input-field");
  const resultDisplay = document.getElementById("result-display");
  const incorrectKeysDisplay = document.getElementById("incorrect-keys-display");

  let codeLines = [];
  let userInputLines = [];
  let currentLineIndex = 0;
  let incorrectKeys = {};
  let startTime;
  let highScore = 0;

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

      function checkInput() {
          const allInput = window.editor.getValue().split("\n");
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
              // 削除処理を無くす
              // userInputLines[currentLineIndex] = currentInput.slice(0, -1);
              // window.editor.setValue(userInputLines.join("\n"));
              // window.editor.setPosition({ lineNumber: currentLineIndex + 1, column: currentInput.length });
          }
      }

      inputField.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
              event.preventDefault();
              const allInput = inputField.value.replace(/\n$/, "").split("\n");
              const currentInput = allInput[currentLineIndex] || "";

              if (currentInput.trim() !== "") {
                  currentLineIndex++;
                  if (currentLineIndex < codeLines.length) {
                      updateInputField();
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

      startButton.addEventListener("click", startGame);
      inputField.addEventListener("input", checkInput);
      window.editor.onDidChangeModelContent(() => {
        checkInput();
      });
    });
  });
});
