const functions = require("firebase-functions");
require("dotenv").config(); // APIキーを環境変数から読み込む
const express = require("express");
const fetch = require("node-fetch"); // APIリクエストを送るため
const app = express();

app.use(express.json());

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
- 説明、コメント、マークダウン構文（  \
\
\
cなど）を出力しないこと。
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

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
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

        const codeSnippets = codeText
          .split("\n")
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

        const contents = [];

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
        contents.push({
            role: "model",
            parts: [{ text: "承知いたしました。C言語に関するご質問でしたら、何でもお聞きください。" }]
        });

        if (Array.isArray(history)) {
            for (const message of history) {
                contents.push({
                    role: message.role === "user" ? "user" : "model",
                    parts: [{ text: message.text }]
                });
            }
        }

        contents.push({
            role: "user",
            parts: [{ text: question }]
        });


        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents }),
        });

        if (!response.ok) {
            throw new Error(`❌ Gemini API リクエスト失敗！ Status: ${response.status}`);
        }

        const data = await response.json();
        let answer = "";
        if (data && data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
            answer = data.candidates[0].content.parts[0].text.trim();
        }

        answer = answer
            .replace(/```[\s\S]*?```/g, "")
            .replace(/`([^`]+)`/g, "$1")
            .replace(/\*\*([^*]+)\*\*/g, "$1")
            .replace(/\*([^*]+)\*/g, "$1")
            .replace(/__([^_]+)__/g, "$1")
            .replace(/~~([^~]+)~~/g, "$1")
            .replace(/\r\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
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

        const basePrompt = `
        あなたはC言語のクイズを生成するエキスパートです。
        以下のC言語プログラムを題材として、指定された形式の4択クイズを1問作成してください。

        【共通の制約】
        - 回答は必ず以下のJSON形式で、JSONオブジェクトのみを出力してください。
        - 説明やマークダウン(\
\
\
jsonなど)は一切含めないでください。
        - JSONのキーは必ずダブルクォーテーションで囲んでください。
        - JSONの文字列値の中にダブルクォーテーション(\
\")が含まれる場合は、必ずバックスラッシュでエスケープしてください（例: \
\\\\\\\"\
）。これは絶対に守ってください。
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
        \
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

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
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

app.post("/evaluate-comments", async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("❌ APIキーが設定されていません！");

        const { codeWithComments } = req.body;
        if (!codeWithComments) {
            return res.status(400).json({ error: "評価するコードがありません。" });
        }

        const prompt = `
        あなたは経験豊富なシニアソフトウェアエンジニアとして、ジュニア開発者がC言語のプログラムに書いたコードコメントをレビューしてください。
        以下の6つの評価基準に基づき、コメントの品質を100点満点で採点し、各項目について具体的なフィードバックを日本語で提供してください。
        プログラムはAIが自動生成したもので、そのプログラムに対してジュニア開発者がコメントを書き加えたものです。そのため、以下のルールを守ってください。
        - 重要：プログラム中にコメントが全くない場合は、全ての評価基準で0点とし、フィードバックも「コメントが全くないため評価できません。」とだけ答えてください。
        - プログラム自体の評価は行わず、あくまでコメントの品質のみを評価してください。
        - 「このプログラムがどのような意図で作られたのか」を補足するコメントはジュニア開発者は書いていない可能性が高いので、その点は評価に含めないでください。
        - 10行程度の短いコードに対してコメントが少ない場合でも、量が少ないこと自体を過度に減点しないでください。
        - コメントにプログラムと関係ない内容が含まれている場合は、その点を正確に指摘して大幅に減点してください。

        【評価基準】
        1.  **量 (Density)**: コードの量に対してコメントは少なすぎたり多すぎたりしませんか？ 適切なバランスが取れていますか？
        2.  **意味 (Meaningfulness)**: コメントはコードの単なる翻訳（例: i++; に「iを1増やす」）になっていませんか？ 
        3.  **明瞭さ (Clarity)**: コメントは専門用語を使いすぎず、誰が読んでも分かりやすい言葉で書かれていますか？（プログラムに関係ないコメントがある場合はこの項目の得点をかなり下げてください）
        4.  **正確性 (Accuracy)**: コメントの内容は、対応するコードの動作と正確に一致していますか？「あいうえお」のような意味のないコメントはありませんか？（プログラムと関連しないコメントがある場合はこの項目の得点をかなり下げてください）
        5.  **付加価値 (Value-add)**: 一読しただけでは分かりにくい複雑なロジックや、コードの重要な前提条件を補足説明できていますか？
        6.  **スタイル (Style)**: コメントの書き方（例: // や /* */）やインデント、配置は一貫性があり、読みやすいですか？

        【回答形式】
        以下のJSON形式で、JSONオブジェクトのみを出力してください。説明やマークダウンは一切含めないでください。
        JSONの各キーは必ずダブルクォーテーションで囲んでください。
        JSONの文字列値にダブルクォーテーションが含まれる場合は、必ず \" のようにエスケープしてください。

        {
          "overallScore": <総合点(0-100)>,
          "scores": {
            "density": <量に関する0-100点の評価>,
            "meaningfulness": <意味に関する0-100点の評価>,
            "clarity": <明瞭さに関する0-100点の評価>,
            "accuracy": <正確性に関する0-100点の評価>,
            "value": <付加価値に関する0-100点の評価>,
            "style": <スタイルに関する0-100点の評価>
          },
          "feedback": {
            "density": "<量に関するフィードバック>",
            "meaningfulness": "<意味に関するフィードバック>",
            "clarity": "<明瞭さに関するフィードバック>",
            "accuracy": "<正確性に関するフィードバック>",
            "value": "<付加価値に関するフィードバック>",
            "style": "<スタイルに関するフィードバック>"
          },
          "generalComment": "<全体的な評価と、改善に向けた総合的なアドバイス>"
        }

        【レビュー対象のコード】
        \
        ```c
        ${codeWithComments}
        ```
        `;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Gemini API Error:", response.status, errorBody);
            throw new Error(`❌ Gemini API リクエスト失敗！ Status: ${response.status}`);
        }

        const data = await response.json();
        const rawText = data.candidates[0].content.parts[0].text;
        const jsonMatch = rawText.match(/\{.*\}/s);
        if (!jsonMatch) {
            console.error("Could not find JSON in response:", rawText);
            throw new Error("❌ APIが有効な評価データを返しませんでした。");
        }

        const cleanedJsonString = jsonMatch[0].replace(/,(\s*[}\]])/g, 
$1);
        try {
            const evalData = JSON.parse(cleanedJsonString);
            res.json(evalData);
        } catch (parseError) {
            console.error("Failed to parse cleaned JSON for evaluation:", parseError);
            throw new Error("❌ APIが返した評価データの解析に失敗しました。");
        }

    } catch (error) {
        console.error("Error evaluating comments:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post("/get-refactor-puzzle", async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("❌ APIキーが設定されていません！");

        const puzzleTypes = [
            { name: '行の移動', keys: 'Alt + ↓/↑', instruction: '行が間違った場所にある（例：変数が使用された後に宣言されている）。' },
            { name: 'インデント修正', keys: 'Tab / Shift+Tab', instruction: '1〜2行のインデントが間違っている（多すぎる、または少なすぎる）。' },
            { name: '行の削除', keys: 'Ctrl + Shift + K', instruction: '明らかに不要な行（デバッグ用のprintfなど）が1行だけ含まれている。' },
            { name: '行コメントの切り替え', keys: 'Ctrl + /', instruction: '実行されるべきコード行が1行だけコメントアウトされている。' },
            { name: 'キーワード置換', keys: 'Ctrl + F → Ctrl + H', instruction: '複数の行にわたって、同じ単語（3文字以上）を別の単語に修正する必要がある（例：「tmp」を「temp」に）。' }
        ];

        // ランダムに3つのパズルタイプを選択
        const selectedPuzzles = [];
        const availableTypes = [...puzzleTypes];
        for (let i = 0; i < 3; i++) {
            if (availableTypes.length === 0) break;
            const randomIndex = Math.floor(Math.random() * availableTypes.length);
            selectedPuzzles.push(availableTypes.splice(randomIndex, 1)[0]);
        }

        const instructions = selectedPuzzles.map(p => `・ ${p.instruction}`).join('\n');

        const prompt = `
        あなたはC言語のプログラミング指導の専門家です。
        あなたのタスクは、リファクタリング練習問題用のC言語コードのスニペットをペアで生成することです。

        1.  最初に、シンプルで正しいC言語のプログラムを、長さ15行程度で作成してください。
        2.  次に、そのプログラムの「ごちゃ混ぜ」バージョンを作成してください。このバージョンには、以下の種類のエラーをそれぞれ1つずつ、合計${selectedPuzzles.length}個含めてください。
        ${instructions}

        重要:
        ・（変数宣言が一時的にずれる問題以外は）コンパイルの妨げになるような構文エラーは含めないでください。目的はコードの構造を修正することです。
        ・出力は以下のJSON形式のみで提供してください。他のテキスト、説明、マークダウンは一切含めないでください。
        ・プログラムのインデントは必ず半角スペース4つで行ってください。半角スペース2つで表現しないでください。
        ・行始めや行終わりに不要な半角スペースを含めないでください。
        {
          "correctCode": "...",
          "scrambledCode": "..."
        }
        `;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Gemini API Error:", response.status, errorBody);
            throw new Error(`❌ Gemini API リクエスト失敗！ Status: ${response.status}`);
        }

        const data = await response.json();
        const rawText = data.candidates[0].content.parts[0].text;
        const jsonMatch = rawText.match(/\{.*\}/s);
        if (!jsonMatch) {
            console.error("Could not find JSON in response:", rawText);
            throw new Error("❌ APIが有効なパズルデータを返しませんでした。");
        }

        const cleanedJsonString = jsonMatch[0].replace(/,(\s*[}\]])/g, 
$1);
        try {
            const puzzleData = JSON.parse(cleanedJsonString);
            // Add hints to the response
            puzzleData.hints = selectedPuzzles.map(p => ({ name: p.name, keys: p.keys }));
            res.json(puzzleData);
        } catch (parseError) {
            console.error("Failed to parse cleaned JSON for puzzle:", parseError);
            throw new Error("❌ APIが返したパズルデータの解析に失敗しました。");
        }

    } catch (error) {
        console.error("Error fetching refactor puzzle:", error.message);
        res.status(500).json({ error: error.message });
    }
});

exports.api = functions.https.onRequest(app);