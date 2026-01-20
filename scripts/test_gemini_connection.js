require('dotenv').config();
const fetch = require('node-fetch');

async function testModel(modelName) {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log(`Testing model: ${modelName}`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Hello" }] }]
            })
        });

        if (response.ok) {
            console.log(`✅ ${modelName} is working.`);
            return modelName;
        } else {
            // const text = await response.text();
            // console.error(`❌ ${modelName} failed: ${response.status}`);
             // Keep it clean
             console.error(`❌ ${modelName} failed: ${response.status}`);
            return null;
        }
    } catch (e) {
        console.error(`❌ ${modelName} error: ${e.message}`);
        return null;
    }
}

async function run() {
    console.log("--- Finding a working model ---");
    const candidates = [
        'gemini-2.0-flash-exp',
        'gemini-2.0-flash-lite',
        'gemini-2.5-flash',
        'gemini-flash-latest',
        'gemini-2.0-flash-001'
    ];

    for (const model of candidates) {
        if (await testModel(model)) {
            console.log(`>>> RECOMMENDED: Use ${model}`);
            break; // Stop after finding the first working one
        }
    }
    console.log("--- Test Complete ---");
}

run();