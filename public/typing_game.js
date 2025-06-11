import { setupGameEvents } from './game_logic.js';
import { setupDiffView } from './diff_view.js';

document.addEventListener("DOMContentLoaded", () => {
    setupGameEvents();
    setupDiffView();
});
