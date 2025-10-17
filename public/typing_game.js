import { auth } from './firebase_auth.js';
import { getUserProfile, getUserPrograms, toggleFavoriteProgram, getProgramMessages, addProgramMessage, deleteProgramMessage } from './firebase_helper.js';
import { setupGameEvents } from './game_logic.js';

async function displayUsername() {
    const user = auth.currentUser;
    if (!user) return;

    const userWelcome = document.getElementById('user-welcome');
    const profile = await getUserProfile(user);

    if (profile && profile.username) {
        userWelcome.textContent = `${profile.username} さん`;
    } else {
        userWelcome.textContent = 'no nameさん';
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Listen for the custom event dispatched from login.js
    document.addEventListener('userLoggedIn', displayUsername);

    // --- Saved Programs Modal Logic ---
    const showProgramsButton = document.getElementById('show-programs-button');
    const programsModal = document.getElementById('programs-modal');
    const closeProgramsModal = document.getElementById('close-programs-modal');
    const programsList = document.getElementById('programs-list');
    const tabFavorite = document.getElementById('tab-favorite');
    const tabNormal = document.getElementById('tab-normal');

    // Program Detail (Chat) Modal Elements
    const detailModal = document.getElementById('program-detail-modal');
    const closeDetailModal = document.getElementById('close-program-detail');
    const detailCode = document.getElementById('detail-program-code');
    const chatHistory = document.getElementById('chat-history');
    const questionInput = document.getElementById('detail-question-input');
    const askButton = document.getElementById('detail-ask-gemini');
    const clearChatButton = document.getElementById('clear-chat-history');

    let currentPrograms = [];
    let activeTab = 'favorite';
    let currentProgramId = null;
    let currentChatMessages = []; // Use state variable for chat

    // --- Chat Functions (Refactored) ---
    const renderChatHistory = () => {
        chatHistory.innerHTML = '';
        currentChatMessages.forEach(msg => {
            const msgDiv = document.createElement('div');
            const roleClass = msg.role === 'user' ? 'chat-user' : 'chat-gemini';
            msgDiv.classList.add('chat-msg', roleClass);
            msgDiv.textContent = msg.text;
            chatHistory.appendChild(msgDiv);
        });
        chatHistory.scrollTop = chatHistory.scrollHeight;
    };

    const askGemini = async () => {
        const user = auth.currentUser;
        const question = questionInput.value.trim();
        if (!user || !question || !currentProgramId) return;

        const code = detailCode.textContent;
        const historyForAPI = [...currentChatMessages];

        const newUserMessage = { role: 'user', text: question };
        currentChatMessages.push(newUserMessage);
        renderChatHistory();
        await addProgramMessage(user, currentProgramId, 'user', question);
        questionInput.value = '';
        askButton.disabled = true;

        try {
            const response = await fetch('/ask-gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, question, history: historyForAPI })
            });
            if (!response.ok) throw new Error('API request failed');
            const data = await response.json();

            const newAiMessage = { role: 'model', text: data.answer };
            currentChatMessages.push(newAiMessage);
            renderChatHistory();
            await addProgramMessage(user, currentProgramId, 'model', data.answer);

        } catch (error) {
            console.error("Error asking Gemini:", error);
            currentChatMessages.pop(); // Remove user message on failure
            renderChatHistory();
        } finally {
            askButton.disabled = false;
        }
    };

    const openDetailView = async (program) => {
        currentProgramId = program.id;
        detailCode.textContent = program.code;
        programsModal.style.display = 'none';
        detailModal.style.display = 'block';

        const user = auth.currentUser;
        if (!user) return;

        currentChatMessages = await getProgramMessages(user, program.id);
        renderChatHistory();
    };

    // --- Render and Event Listeners for Program List ---
    const renderPrograms = () => {
        programsList.innerHTML = '';
        const filteredPrograms = currentPrograms.filter(p => activeTab === 'favorite' ? p.favorite : !p.favorite);

        if (filteredPrograms.length === 0) {
            programsList.innerHTML = `<li>表示するプログラムがありません。</li>`;
            return;
        }

        filteredPrograms.forEach(program => {
            const li = document.createElement('li');
            li.dataset.id = program.id;
            li.addEventListener('click', () => openDetailView(program));

            const pre = document.createElement('pre');
            pre.textContent = program.code;

            const star = document.createElement('span');
            star.className = 'favorite-star';
            star.textContent = '★';
            if (program.favorite) {
                star.classList.add('favorited');
            }
            star.addEventListener('click', async (e) => {
                e.stopPropagation();
                const user = auth.currentUser;
                if (!user) return;
                await toggleFavoriteProgram(user, program.id, program.favorite);
                await openProgramsModal();
            });

            li.appendChild(star);
            li.appendChild(pre);
            programsList.appendChild(li);
        });
    };

    const openProgramsModal = async () => {
        const user = auth.currentUser;
        if (!user) {
            alert('ログインしてください。');
            return;
        }
        currentPrograms = await getUserPrograms(user);
        renderPrograms();
        programsModal.style.display = 'block';
        detailModal.style.display = 'none';
    };

    showProgramsButton.addEventListener('click', openProgramsModal);

    tabFavorite.addEventListener('click', () => {
        activeTab = 'favorite';
        tabFavorite.classList.add('active-tab');
        tabNormal.classList.remove('active-tab');
        renderPrograms();
    });

    tabNormal.addEventListener('click', () => {
        activeTab = 'normal';
        tabNormal.classList.add('active-tab');
        tabFavorite.classList.remove('active-tab');
        renderPrograms();
    });

    // --- Detail Modal Listeners ---
    closeDetailModal.addEventListener('click', () => {
        detailModal.style.display = 'none';
        programsModal.style.display = 'block';
    });

    askButton.addEventListener('click', askGemini);
    questionInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            askGemini();
        }
    });

    clearChatButton.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user || !currentProgramId) return;
        if (!confirm('本当にこのプログラムのチャット履歴をすべて削除しますか？')) return;

        const messages = await getProgramMessages(user, currentProgramId);
        for (const msg of messages) {
            await deleteProgramMessage(user, currentProgramId, msg.id);
        }
        currentChatMessages = []; // Clear state
        renderChatHistory(); // Clear UI
    });
});