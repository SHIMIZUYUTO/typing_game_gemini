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
Generate exactly 5 simple C programming code snippets for beginners. 
Each snippet should:
- Be at most 5 lines long.
- Focus on basic syntax such as variable declaration, loops, conditionals, or functions.
- Be properly formatted with proper indentation and line breaks.
- Avoid unnecessary lines (e.g., no '#include' or other boilerplate code).
- Not include explanations, comments, or markdown syntax (such as \`\`\`c).
- Ensure that each statement ends with a semicolon and no space follows the semicolon.
- Ensure proper indentation for code blocks such as "if", "else", "for", "while", and "functions".
Each snippet should have proper line breaks between the statements.
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

        const codeText = data.candidates[0].content.parts[0].text.trim(); // 生成されたコードテキスト
        const codeSnippets = codeText.split("\n").slice(0, 5); // 改行で区切り、最大5個取得

        // 各コードスニペット内の行を改行で区切り、適切に整形
        const formattedCodeSnippets = codeSnippets.map(snippet => {
            // 行末に余分なスペースを取り除き、適切な改行を維持する
            return snippet
                .split("\n") // 各行で分割
                .map(line => line.trim()) // 行ごとに余分な空白を取り除く
                .join("\n"); // 改行を適切に保持
        });

        res.json({ codeSnippets: formattedCodeSnippets });

    } catch (error) {
        console.error("Error fetching C snippets:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
