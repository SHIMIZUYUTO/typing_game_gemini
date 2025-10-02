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
    setupGameEvents();
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

    // --- Chat Functions ---
    const renderChatHistory = (messages) => {
        chatHistory.innerHTML = '';
        messages.forEach(msg => {
            const msgDiv = document.createElement('div');
            // Apply the correct CSS classes based on style.css
            const roleClass = msg.role === 'user' ? 'chat-user' : 'chat-gemini';
            msgDiv.classList.add('chat-msg', roleClass);
            msgDiv.textContent = msg.text;
            chatHistory.appendChild(msgDiv);
        });
        chatHistory.scrollTop = chatHistory.scrollHeight; // Scroll to bottom
    };

    const askGemini = async () => {
        const user = auth.currentUser;
        const question = questionInput.value.trim();
        if (!user || !question || !currentProgramId) return;

        const code = detailCode.textContent;
        const history = Array.from(chatHistory.children).map(div => ({
            role: div.classList.contains('role-user') ? 'user' : 'model',
            text: div.textContent
        }));

        // Add user message to UI immediately
        renderChatHistory([...history, { role: 'user', text: question }]);
        await addProgramMessage(user, currentProgramId, 'user', question);
        questionInput.value = '';
        askButton.disabled = true;

        try {
            const response = await fetch('/ask-gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, question, history })
            });

            if (!response.ok) throw new Error('API request failed');
            const data = await response.json();

            renderChatHistory([...history, { role: 'user', text: question }, { role: 'model', text: data.answer }]);
            await addProgramMessage(user, currentProgramId, 'model', data.answer);

        } catch (error) {
            console.error("Error asking Gemini:", error);
            // Remove the user's message if the API call fails
            renderChatHistory(history);
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

        const messages = await getProgramMessages(user, program.id);
        renderChatHistory(messages);
    };

    // --- Render and Event Listeners for Program List ---
    const renderPrograms = () => {
        programsList.innerHTML = '';
        const filteredPrograms = currentPrograms.filter(p => {
            return activeTab === 'favorite' ? p.favorite : !p.favorite;
        });

        if (filteredPrograms.length === 0) {
            programsList.innerHTML = `<li>表示するプログラムがありません。</li>`;
            return;
        }

        filteredPrograms.forEach(program => {
            const li = document.createElement('li');
            li.dataset.id = program.id;
            li.addEventListener('click', () => openDetailView(program)); // Open detail view on click

            const pre = document.createElement('pre');
            pre.textContent = program.code;

            const star = document.createElement('span');
            star.className = 'favorite-star';
            star.textContent = '★'; // Always use the solid star
            if (program.favorite) {
                star.classList.add('favorited');
            }
            star.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent li click event
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
        detailModal.style.display = 'none'; // Ensure detail is hidden
    };

    showProgramsButton.addEventListener('click', openProgramsModal);

    closeProgramsModal.addEventListener('click', () => {
        programsModal.style.display = 'none';
    });

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
        programsModal.style.display = 'block'; // Re-show list modal
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
        renderChatHistory([]); // Clear UI
    });
});