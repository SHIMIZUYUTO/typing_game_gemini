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
Generate exactly 1 simple and random C programming code snippets for beginners,outputting only the code as text.
Each snippet should:
- Output content is program only.
- Never output markdown syntax.
- Be at most 10 lines long.
- Focus on basic syntax such as variable declaration, loops, conditionals, or functions.
- Be properly formatted with proper indentation and line breaks.
- Avoid unnecessary lines (e.g., no '#include' or other boilerplate code).
- Never output explanations, comments, or markdown syntax (such as \`\`\`c).
- Ensure that each statement ends with a semicolon and no space follows the semicolon.
- Ensure proper indentation for code blocks such as "if", "else", "for", "while", and "functions".
- Never use double line breaks (\n\n); use single line breaks (\n) instead.
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

        let codeText = data.candidates[0].content.parts[0].text.trim(); // 生成されたコードテキスト
        codeText = codeText.replace(/```c/g, "");
        codeText = codeText.replace(/```\n/g, "");
        codeText = codeText.replace(/\n\n/g, "\n"); // 二重改行を単一改行に置換
        const codeSnippets = codeText.split("\n").slice(0, 10); // 改行で区切り、最大10個取得

        // 各コードスニペット内の行を改行で区切り、適切に整形
        const formattedCodeSnippets = codeSnippets.map(snippet => {
            return snippet
                .split("\n")
                .map(line => line.trim())
                .filter(line => line.length > 0) // 空行を削除
                .join("\n");
        });

        res.json({ codeSnippets: formattedCodeSnippets });

    } catch (error) {
        console.error("Error fetching C snippets:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
