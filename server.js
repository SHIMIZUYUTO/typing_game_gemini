require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static("public")); // publicフォルダのファイルを配信

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

app.post("/get-words", async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("❌ APIキーが設定されていません！");
        }

        // ✅ 最新の Gemini-2.0 Flash API を使用
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        // ✅ 変更したプロンプト
        const promptText = "Output exactly 10 random English words. Each word must be at most 15 letters long. No numbering, no explanations, no punctuation, and all words should be lowercase.";

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

        // APIレスポンスから単語を抽出
        if (!data || !data.candidates || !data.candidates[0].content || !data.candidates[0].content.parts) {
            throw new Error("❌ APIのレスポンスが不正です！");
        }

        const wordsText = data.candidates[0].content.parts[0].text; // 生成されたテキスト
        const words = wordsText.trim().split(/\s+/).slice(0, 10); // 単語を抽出（10個に制限）

        res.json({ words });

    } catch (error) {
        console.error("Error fetching words:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
