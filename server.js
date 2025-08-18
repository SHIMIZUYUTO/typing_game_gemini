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

// MEMO:卒業研究用
// const promptText = `
// プログラムを入力する形式のタイピング練習ゲームを作成しています。
// プログラミングとタイピング初心者のためのランダムなCプログラミングコードスニペットを正確に1つ生成し、コードのみをテキストとして出力してください。
// 各スニペットは
// - 出力内容はプログラムのみ。
// - マークダウン構文を出力しない。
// - 10~15行の範囲内のプログラムを出力する。
// - 毎回異なる内容のプログラムを出力する。（これが一番重要です）
// - 適切なインデントと改行で適切にフォーマットする。
// - インデントは半角スペース4つで行うこと。
// - print文などに日本語を含めないこと。
// - 説明、コメント、マークダウン構文（  \`\`\`cなど）を出力しないこと。
// - 各ステートメントがセミコロンで終わり、セミコロンの後にスペースが続かないようにする。
// - セミコロンの直前に不要な半角ペースを入れないこと。
// - if、else、for、while、functions などのコードブロックのインデントが適切であることを確認してください。
// - 二重改行は絶対にしないでください。
// - 各スニペットでは、文と文の間に適切な改行を入れてください。
// `;

// MEMO:オープンキャンパス用
const promptText = `
プログラムを入力する形式のタイピング練習ゲームを作成しています。
プログラミングとタイピング初心者のためのランダムなCプログラミングコードスニペットを正確に1つ生成し、コードのみをテキストとして出力してください。
各スニペットは
- 出力内容はプログラムのみ。
- マークダウン構文を出力しない。
- 10行以内のプログラムを出力する。
- タッチタイピングができない人でも1分以内で入力完了できる量のプログラムを出力する。
- 毎回異なる内容のプログラムを出力する。（これが一番重要です）
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
        if (!apiKey) throw new Error("❌ APIキーが設定されていません！");

        const lineCount = req.body.lineCount || 18; // デフォルトは18行

        let prompt = promptText.replace(
            "- 10行以内のプログラムを出力する。",
            `- ${lineCount}行程度のプログラムを出力する。`
        );

        // カスタムキー
        if (req.body && Array.isArray(req.body.topMistakeKeys) && req.body.topMistakeKeys.length > 0) {
            const keys = req.body.topMistakeKeys.map(k => `"${k}"`).join(", ");
            prompt = `${prompt}
            また、以下の文字（キー）が多めに含まれるようなCプログラムを生成してください: ${keys}
            `;
        }
        // 好きな題材から生成
        if (req.body && req.body.customTheme && req.body.customTheme.length > 0) {
            prompt = `${prompt}
            また、プログラムの内容や変数名、処理内容などに「${req.body.customTheme}」という題材を必ず盛り込んでください。題材がジャンルであればプログラムのジャンルを変更してください。関数の作成のようなプログラムに自体に関わる題材の場合は、それが含まれるプログラムを作成してください。いずれの題材にしても、プログラム中に日本語は含まないでください。
            `;
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
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

        const codeSnippets = codeText
          .split("\n")
        //   .map(line => line.replace(/\s+$/, "")) // 行末のみトリム
        .filter(line => line.length > 0)
          .slice(0, lineCount);


        res.json({ codeSnippets: codeSnippets });

    } catch (error) {
        console.error("Error fetching C snippets:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post("/ask-gemini", async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("❌ APIキーが設定されていません！");

        const { code, question, history } = req.body;
        if (!code || !question) {
            return res.status(400).json({ error: "codeとquestionは必須です" });
        }

        // Gemini APIのcontentsを作成
        const contents = [];

        // 1. システムプロンプト的な役割を果たす最初のuserパート
        contents.push({
            role: "user",
            parts: [{
                text: `
                あなたはC言語のエキスパートです。以下のC言語プログラムについて、ユーザーからの質問に日本語で分かりやすく答えてください。
                なお、太字を始めとしたマークダウン構文は絶対に出力しないでください。
                ユーザーがプログラムに関係ない質問をした場合は、ユーザーの体たらくを少し糾弾するようなウィットに富んだ返しをしてください。
                【プログラム】
                ${code}
                `
            }]
        });
        // 2. 自己紹介と応答準備完了を伝える最初のmodelパート
        contents.push({
            role: "model",
            parts: [{ text: "承知いたしました。C言語に関するご質問でしたら、何でもお聞きください。" }]
        });

        // 3. 過去の会話履歴をcontentsに追加
        if (Array.isArray(history)) {
            for (const message of history) {
                contents.push({
                    role: message.role === "user" ? "user" : "model",
                    parts: [{ text: message.text }]
                });
            }
        }

        // 4. 今回の新しい質問を追加
        contents.push({
            role: "user",
            parts: [{ text: question }]
        });


        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents }), // 修正：contentsを直接渡す
        });

        if (!response.ok) {
            throw new Error(`❌ Gemini API リクエスト失敗！ Status: ${response.status}`);
        }

        const data = await response.json();
        let answer = "";
        if (data && data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
            answer = data.candidates[0].content.parts[0].text.trim();
        }

        // マークダウンや不要な改行を除去
        answer = answer
            .replace(/```[\s\S]*?```/g, "") // コードブロック
            .replace(/`([^`]+)`/g, "$1")    // インラインコード
            .replace(/\*\*([^*]+)\*\*/g, "$1") // 太字
            .replace(/\*([^*]+)\*/g, "$1")     // 斜体
            .replace(/__([^_]+)__/g, "$1")     // 下線
            .replace(/~~([^~]+)~~/g, "$1")     // 打ち消し
            .replace(/\r\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")        // 3つ以上の連続改行を2つに
            .trim();

        res.json({ answer });
    } catch (error) {
        console.error("Gemini質問APIエラー:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
