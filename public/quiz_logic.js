import { auth } from './firebase_auth.js';
import { getUserPrograms, saveQuizResult, getQuizResults } from './firebase_helper.js';

// === MODAL ELEMENTS ===
const quizModal = document.getElementById('quiz-modal');
const quizHistoryModal = document.getElementById('quiz-history-modal');

// === BUTTONS ===
const startQuizButton = document.getElementById('start-quiz-button');
const cancelQuizButton = document.getElementById('cancel-quiz-button');
const startQuizConfirmButton = document.getElementById('start-quiz-confirm-button');
const closeQuizResultsButton = document.getElementById('close-quiz-results-button');
const quizHistoryButton = document.getElementById('quiz-history-button');
const closeQuizHistoryButton = document.getElementById('close-quiz-history-button');
const backToHistoryListButton = document.getElementById('back-to-history-list-button');

// === UI PANES & CONTAINERS ===
const quizSetup = document.getElementById('quiz-setup');
const quizMain = document.getElementById('quiz-main');
const quizResults = document.getElementById('quiz-results');
const questionCounter = document.getElementById('quiz-question-counter');
const questionText = document.getElementById('quiz-question-text'); // New
const codeSnippet = document.getElementById('quiz-code-snippet');
const feedbackContainer = document.getElementById('quiz-feedback'); // New
const choicesContainer = document.getElementById('quiz-choices');
const scoreDisplay = document.getElementById('quiz-score');
const reviewContainer = document.getElementById('quiz-review');
const quizHistoryList = document.getElementById('quiz-history-list');
const quizHistoryDetail = document.getElementById('quiz-history-detail');
const quizHistoryDetailContent = document.getElementById('quiz-history-detail-content');
const quizTypeSelect = document.getElementById('quiz-type-select'); // New

// === QUIZ STATE ===
let quizQuestions = [];
let currentQuestionIndex = 0;
let userScore = 0;
let userAnswers = [];

// === INITIALIZATION ===
function initializeQuiz() {
    startQuizButton.addEventListener('click', showQuizSetup);
    cancelQuizButton.addEventListener('click', hideQuizModal);
    closeQuizResultsButton.addEventListener('click', hideQuizModal);
    startQuizConfirmButton.addEventListener('click', startQuiz);
    quizHistoryButton.addEventListener('click', showQuizHistory);
    closeQuizHistoryButton.addEventListener('click', () => quizHistoryModal.style.display = 'none');
    backToHistoryListButton.addEventListener('click', () => {
        quizHistoryDetail.style.display = 'none';
        quizHistoryList.style.display = 'block';
    });
}

// === MAIN QUIZ FLOW ===

async function showQuizSetup() {
    const user = auth.currentUser;
    if (!user) {
        alert("クイズを始めるにはログインしてください。");
        return;
    }
    const allPrograms = await getUserPrograms(user);
    const favoritePrograms = allPrograms.filter(p => p.favorite);
    if (favoritePrograms.length === 0) {
        alert("クイズを生成するには、お気に入りに登録したプログラムが1つ以上必要です。");
        return;
    }
    quizMain.style.display = 'none';
    quizResults.style.display = 'none';
    quizSetup.style.display = 'block';
    quizModal.style.display = 'flex';
}

function hideQuizModal() {
    quizModal.style.display = 'none';
}

async function startQuiz() {
    const user = auth.currentUser;
    if (!user) return alert("ログインが必要です。");

    const numQuestions = parseInt(document.getElementById('quiz-num-questions').value, 10);
    if (isNaN(numQuestions) || numQuestions < 3 || numQuestions > 10) {
        return alert("問題数は3から10の間で選択してください。");
    }

    const quizType = quizTypeSelect.value; // Get selected quiz type

    const favoritePrograms = (await getUserPrograms(user)).filter(p => p.favorite);
    if (favoritePrograms.length < 1) {
        return alert(`クイズを生成するのに十分な数のお気に入りプログラムがありません。`);
    }

    quizSetup.style.display = 'none';
    quizMain.style.display = 'block';
    questionCounter.textContent = '問題生成中...';
    questionText.textContent = 'Geminiが問題を考えています...';
    codeSnippet.textContent = '少々お待ちください...';
    choicesContainer.innerHTML = '';
    feedbackContainer.innerHTML = '';

    try {
        const selectedPrograms = Array.from({ length: numQuestions }, () => favoritePrograms[Math.floor(Math.random() * favoritePrograms.length)]);
        
        const questionPromises = selectedPrograms.map(program =>
            fetch("/generate-quiz-question", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: program.code, quizType: quizType }) // Pass quizType
            }).then(res => res.ok ? res.json() : Promise.reject(new Error('問題の生成に失敗しました。')))
        );

        quizQuestions = await Promise.all(questionPromises);
        currentQuestionIndex = 0;
        userScore = 0;
        userAnswers = [];
        displayQuestion();
    } catch (error) {
        console.error("Error starting quiz:", error);
        alert(error.message || "クイズの開始中にエラーが発生しました。");
        hideQuizModal();
    }
}

function displayQuestion() {
    console.log("Displaying question:", quizQuestions[currentQuestionIndex]); // デバッグ用ログ
    if (currentQuestionIndex >= quizQuestions.length) {
        showResults();
        return;
    }
    const question = quizQuestions[currentQuestionIndex];
    questionCounter.textContent = `問題 ${currentQuestionIndex + 1} / ${quizQuestions.length}`;
    questionText.textContent = question.questionText;
    codeSnippet.textContent = question.questionCode;
    choicesContainer.innerHTML = '';
    feedbackContainer.innerHTML = ''; // Clear previous feedback

    question.choices.forEach(choice => {
        const button = document.createElement('button');
        button.textContent = choice.replace(/\n/g, ' ⏎ '); // Replace newlines with return symbol
        button.addEventListener('click', () => handleAnswer(choice, button));
        choicesContainer.appendChild(button);
    });
}

function handleAnswer(selectedChoice, selectedButton) {
    const question = quizQuestions[currentQuestionIndex];
    const isCorrect = selectedChoice === question.answer;
    
    // Store full question and answer for review
    userAnswers.push({
        question: question,
        selected: selectedChoice,
        correct: question.answer
    });

    if (isCorrect) {
        userScore++;
        feedbackContainer.textContent = '正解！';
        feedbackContainer.className = 'correct';
    } else {
        feedbackContainer.textContent = '不正解…';
        feedbackContainer.className = 'incorrect';
    }

    Array.from(choicesContainer.children).forEach(button => {
        button.disabled = true;
        if (button.textContent === question.answer) button.classList.add('correct');
        else if (button === selectedButton) button.classList.add('incorrect');
    });

    setTimeout(() => { currentQuestionIndex++; displayQuestion(); }, 2000); // Increased delay to see feedback
}

function showResults() {
    quizMain.style.display = 'none';
    quizResults.style.display = 'block';
    scoreDisplay.textContent = `結果: ${userScore} / ${quizQuestions.length} 問正解！`;
    reviewContainer.innerHTML = '<h3>問題の振り返り</h3>';
    
    const fullQuizData = {
        score: userScore,
        totalQuestions: quizQuestions.length,
        questions: userAnswers.map(ua => ({
            ...ua.question,
            userAnswer: ua.selected
        }))
    };

    fullQuizData.questions.forEach((q, index) => {
        renderReviewItem(reviewContainer, q, index);
    });

    const user = auth.currentUser;
    if (user) {
        saveQuizResult(user, fullQuizData)
            .then(() => console.log("Quiz result saved."))
            .catch(err => console.error("Failed to save quiz result:", err));
    }
}

// === QUIZ HISTORY FLOW ===

async function showQuizHistory() {
    const user = auth.currentUser;
    if (!user) return alert("ログインしてください。");

    quizHistoryList.innerHTML = '<li>読み込み中...</li>';
    quizHistoryDetail.style.display = 'none';
    quizHistoryList.style.display = 'block';
    quizHistoryModal.style.display = 'flex';

    const results = await getQuizResults(user);
    quizHistoryList.innerHTML = '';
    if (results.length === 0) {
        quizHistoryList.innerHTML = '<li>まだクイズの履歴はありません。</li>';
        return;
    }

    results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'history-list-item';
        const date = result.timestamp.toDate ? result.timestamp.toDate() : new Date(result.timestamp.seconds * 1000);
        item.innerHTML = `
            <span class="history-item-date">${date.toLocaleString()}</span>
            <span class="history-item-score">${result.score} / ${result.totalQuestions} 問正解</span>
        `;
        item.addEventListener('click', () => displayQuizResultDetails(result));
        quizHistoryList.appendChild(item);
    });
}

function displayQuizResultDetails(result) {
    quizHistoryList.style.display = 'none';
    quizHistoryDetail.style.display = 'block';
    quizHistoryDetailContent.innerHTML = '';

    const header = document.createElement('h3');
    const date = result.timestamp.toDate ? result.timestamp.toDate() : new Date(result.timestamp.seconds * 1000);
    header.textContent = `${date.toLocaleString()} の結果 (${result.score}/${result.totalQuestions}正解)`;
    quizHistoryDetailContent.appendChild(header);

    result.questions.forEach((question, index) => {
        renderReviewItem(quizHistoryDetailContent, question, index);
    });
}

// === UTILITY ===

function renderReviewItem(container, question, index) {
    const item = document.createElement('div');
    item.className = 'review-item';
    const isCorrect = question.userAnswer === question.answer;
    const resultText = isCorrect ? '正解' : '不正解';
    const resultClass = isCorrect ? 'correct' : 'incorrect';

    const escapedCode = (question.questionCode || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const escapedExplanation = (question.explanation || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");

    item.innerHTML = `
        <h4>問題 ${index + 1} <span class="review-answer ${resultClass}">(${resultText})</span></h4>
        <p><b>${question.questionText}</b></p>
        <pre>${escapedCode}</pre>
        <p>あなたの回答: <span class="review-answer ${resultClass}">${question.userAnswer}</span></p>
        <p>正解: <span class="review-answer correct">${question.answer}</span></p>
        ${escapedExplanation ? `<p>解説:</p><pre>${escapedExplanation}</pre>` : ''}
    `;
    container.appendChild(item);
}

// === KICK-OFF ===
initializeQuiz();