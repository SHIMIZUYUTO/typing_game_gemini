import { auth } from './firebase_auth.js';
import { getRanking } from './firebase_helper.js';

const rankingButton = document.getElementById('ranking-button');
const rankingModal = document.getElementById('ranking-modal');
const closeRankingModal = document.getElementById('close-ranking-modal');
const rankingList = document.getElementById('ranking-list');

// Function to open the modal and display rankings
async function showRanking() {
    if (!auth.currentUser) {
        alert('ランキングを見るにはログインが必要です。');
        return;
    }

    try {
        rankingList.innerHTML = '<p>ランキングを読み込み中...</p>';
        rankingModal.style.display = 'flex';

        const rankingData = await getRanking();

        if (rankingData.length === 0) {
            rankingList.innerHTML = '<p>まだランキングデータがありません。</p>';
            return;
        }

        // Clear old content
        rankingList.innerHTML = '';

        // Add header
        const header = document.createElement('div');
        header.className = 'ranking-header';
        header.innerHTML = `
            <span class="rank-position">順位</span>
            <span class="rank-name">ユーザー名</span>
            <span class="rank-speed">平均速度 (回/秒)</span>
        `;
        rankingList.appendChild(header);

        // Add ranking items
        rankingData.forEach((user, index) => {
            const item = document.createElement('div');
            item.className = 'ranking-item';

            // Highlight current user
            if (user.id === auth.currentUser.uid) {
                item.classList.add('current-user-rank');
            }

            const position = `<span class="rank-position">${index + 1}</span>`;
            const name = `<span class="rank-name">${user.username || '名無しさん'}</span>`;
            const speed = `<span class="rank-speed">${user.averageSpeed.toFixed(2)}</span>`;

            item.innerHTML = `${position}${name}${speed}`;
            rankingList.appendChild(item);
        });

    } catch (error) {
        console.error("Error fetching ranking: ", error);
        rankingList.innerHTML = '<p>ランキングの読み込みに失敗しました。</p>';
    }
}

// Event Listeners
rankingButton.addEventListener('click', showRanking);
closeRankingModal.addEventListener('click', () => {
    rankingModal.style.display = 'none';
});

// Close modal if user clicks outside of the modal content
window.addEventListener('click', (event) => {
    if (event.target === rankingModal) {
        rankingModal.style.display = 'none';
    }
});
