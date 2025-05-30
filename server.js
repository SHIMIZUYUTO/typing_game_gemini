require("dotenv").config(); // APIキーを環境変数から読み込む
const express = require("express");
const fetch = require("node-fetch"); // APIリクエストを送るため
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => { // /にアクセスしたらindex.htmlを返す
    res.sendFile(__dirname + "/public/index.html");
});

const promptText = `
初心者のためのランダムなCプログラミングコードスニペットを正確に1つ生成し、コードのみをテキストとして出力してください。
各スニペットは
- 出力内容はプログラムのみ。
- マークダウン構文を出力しない。
- 10行程度のプログラムを出力する。
- 毎回異なる内容のプログラムを出力する。
- 適切なインデントと改行で適切にフォーマットする。
- インデントは半角スペース4つで行うこと。
- print文などに日本語を含めないこと。
- 説明、コメント、マークダウン構文（  \`\`\`cなど）を出力しないこと。
- 各ステートメントがセミコロンで終わり、セミコロンの後にスペースが続かないようにする。
- セミコロンの直前に不要な半角ペースを入れないこと。
- if、else、for、while、functions などのコードブロックのインデントが適切であることを確認してください。
- 二重改行は絶対にしないでください。
- 各スニペットでは、文と文の間に適切な改行を入れてください。
`;

app.post("/get-words", async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("❌ APIキーが設定されていません！");
        }

        // Gemini-2.0 Flash API を使用
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }]
            }),
        });

        if (!response.ok) {
            throw new Error(`❌ Gemini API リクエスト失敗！ Status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Gemini API Response:", JSON.stringify(data, null, 2)); // APIレスポンスを確認

        // APIレスポンスからC言語コードを抽出
        if (!data || !data.candidates || !data.candidates[0].content || !data.candidates[0].content.parts) {
            throw new Error("❌ APIのレスポンスが不正です！");
        }

        let codeText = data.candidates[0].content.parts[0].text.trim();
        codeText = codeText.replace(/```c\n/g, "");
        codeText = codeText.replace(/```/g, "");
        codeText = codeText.replace(/\r\n/g, "\n");
        codeText = codeText.replace(/\n{2,}/g, "\n");
        // codeText = codeText.replace(/  /g, "    "); // 2つのスペースをスペース4つに変換
        // codeText = codeText.replace(/        /g, "    "); // スペース8個をスペース4つに変換

        // インデントを残して空行だけ除去
        const codeSnippets = codeText
          .split("\n")
        //   .map(line => line.replace(/\s+$/, "")) // 行末のみトリム
          .filter(line => line.length > 0)
          .slice(0, 20);


        res.json({ codeSnippets: codeSnippets });

    } catch (error) {
        console.error("Error fetching C snippets:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
