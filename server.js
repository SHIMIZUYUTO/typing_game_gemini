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
          .slice(0, 35);


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

app.post("/generate-quiz-question", async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("❌ APIキーが設定されていません！");

        const { code, quizType } = req.body;
        if (!code || !quizType) {
            return res.status(400).json({ error: "コードとクイズタイプは必須です。" });
        }

        // Base prompt with common instructions
        const basePrompt = `
        あなたはC言語のクイズを生成するエキスパートです。
        以下のC言語プログラムを題材として、指定された形式の4択クイズを1問作成してください。

        【共通の制約】
        - 回答は必ず以下のJSON形式で、JSONオブジェクトのみを出力してください。
        - 説明やマークダウン(\\\`\\\`\\\`jsonなど)は一切含めないでください。
        - JSONのキーは必ずダブルクォーテーションで囲んでください。
        - JSONの文字列値の中にダブルクォーテーション(\`\"\`)が含まれる場合は、必ずバックスラッシュでエスケープしてください（例: \`\\\\\"\`）。これは絶対に守ってください。
        - 選択肢の配列("choices")の要素の順番は必ずランダムにしてください。
        - 不正解の選択肢は、学習者が間違いやすいような、もっともらしい選択肢を考えてください。
        - 全く同じ選択肢は絶対に含めないでください。
        - 生成する問題は、プログラムのごく一部に関するものではなく、プログラム全体の動作を理解しないと解けないような、思考力を問う問題にしてください。

        【共通のJSON形式】
        {
          "quizType": "（指定されたクイズタイプ）",
          "questionText": "（ユーザーに問いかける質問文）",
          "questionCode": "（問題となるプログラムコード）",
          "choices": [ "（選択肢1）", "（選択肢2）", "（選択肢3）", "（選択肢4）" ],
          "answer": "（正解の選択肢）",
          "explanation": "（なぜその答えになるのかの簡単な解説）"
        }

        【プログラム】
        \\
        ${code}
        `;

        let specificPrompt = "";
        switch (quizType) {
            case "predict_output":
                specificPrompt = `
                【今回の問題形式】
                - 形式: "predict_output"
                - 質問文: "このプログラムを実行した結果、出力される内容はどれですか？"
                - 問題内容: プログラム全体の最終的な出力結果を予測する問題を作成してください。
                - 選択肢: 4つの異なる出力結果を提示してください。そのうち1つが正解です。
                `;
                break;
            case "loop_count":
                specificPrompt = `
                【今回の問題形式】
                - 形式: "loop_count"
                - 質問文: "このプログラムに含まれるfor文またはwhile文は、合計で何回ループしますか？"
                - 問題内容: プログラム内にfor文かwhile文が存在する場合、そのループが実行される合計回数を問う問題を作成してください。もしループが複数ある場合は、最も主要なループの実行回数を尋ねてください。
                - 選択肢: 4つの異なる回数を提示してください（例: "5回", "10回", "無限ループ"）。そのうち1つが正解です。
                - 注意: ループが存在しないプログラムの場合は、エラーではなく、「このプログラムにループはありません」と答える選択肢を正解としてください。
                `;
                break;
            case "predict_next_line_meaning":
                specificPrompt = `
                【今回の問題形式】
                - 形式: "predict_next_line_meaning"
                - 問題内容: プログラムの中から、次の一行の理解度を問うのに適切な箇所を自動で選んでください。
                - 質問文: "以下のプログラムの次に実行される処理はどれですか？"
                - 表示するコード("questionCode"): 選んだ箇所の直前までの2〜5行のコードを提示してください。
                - 選択肢: 次に実行される一行の処理内容を説明する、平易な日本語の文章を4つ提示してください。
                - 正解: 4つのうち1つだけを、実際に次に実行されるコードの正しい説明にしてください。
                - 解説("explanation"): 正解の選択肢が説明している実際のコード行を提示してください。
                `;
                break;
            default:
                return res.status(400).json({ error: "無効なクイズタイプです。" });
        }

        const finalPrompt = basePrompt + specificPrompt;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: finalPrompt }] }]
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Gemini API Error:", response.status, errorBody);
            throw new Error(`❌ Gemini API リクエスト失敗！ Status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0].content || !data.candidates[0].content.parts) {
            console.error("Invalid Gemini Response:", JSON.stringify(data, null, 2));
            throw new Error("❌ APIのレスポンスが不正です！");
        }

        const rawText = data.candidates[0].content.parts[0].text;
        const jsonMatch = rawText.match(/\{.*\}/s);
        if (!jsonMatch) {
            console.error("Could not find JSON in response:", rawText);
            throw new Error("❌ APIが有効なクイズデータを返しませんでした。");
        }

        // Clean the JSON string to remove trailing commas
        const cleanedJsonString = jsonMatch[0].replace(/,(\s*[}\]])/g, '$1');

        try {
            const quizData = JSON.parse(cleanedJsonString);
            res.json(quizData);
        } catch (parseError) {
            console.error("Failed to parse cleaned JSON:", parseError);
            console.error("Original JSON string was:", jsonMatch[0]);
            console.error("Cleaned JSON string was:", cleanedJsonString);
            throw new Error("❌ APIが返したデータの解析に失敗しました。");
        }

    } catch (error) {
        console.error("Error generating quiz question:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));