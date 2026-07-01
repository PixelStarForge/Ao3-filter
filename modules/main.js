import { saveToStorage } from './storage.js';
import { setDarkMode, toggleDarkMode } from './darkMode.js';
import {
    renderBlockedAuthors,
    renderBlockedTags,
    renderBlockedFics,
    generateCSSFromPrefs,
    renderBlockedLanguages,
    updateStatsBar
} from './blockList.js';
import {
    generateAuthorCSS,
    addAuthorToBlockList,
    blockAnonymousFics
} from './author.js';
import {
    fetchFicTags,
    updateTagCSS,
    addSelectedTagsToBlockList,
    selectAllTags,
    clearAllTags
} from './tags.js';
import {
    fetchAuthorFics,
    updateFicsCSS,
    addSelectedFicsToBlockList,
    selectAllFics,
    clearAllFics
} from './fics.js';
import {
    exportBlockList,
    exportCSS,
    importBlockList
} from './exportImport.js';
import { copyToClipboard, downloadCSS, clearInput } from './utils.js';

// ---------- Tab switching ----------
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
}

// ---------- Keyboard shortcuts (Enter) ----------
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab.id === 'author') generateAuthorCSS();
        else if (activeTab.id === 'tags') fetchFicTags();
        else if (activeTab.id === 'fics') fetchAuthorFics();
    }
});

// ---------- DOM ready ----------
document.addEventListener('DOMContentLoaded', function () {

    // --- Dark mode ---
    chrome.storage.local.get(['darkMode'], (result) => {
        const dark = result.darkMode === undefined ? true : (result.darkMode === 'true');
        setDarkMode(dark);
    });
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);

    // --- Restore saved inputs ---
    chrome.storage.local.get(['lastAuthorUrl', 'lastFicUrl', 'lastFicAuthorUrl'], (result) => {
        if (result.lastAuthorUrl) document.getElementById('authorUrl').value = result.lastAuthorUrl;
        if (result.lastFicUrl) document.getElementById('ficUrl').value = result.lastFicUrl;
        if (result.lastFicAuthorUrl) document.getElementById('ficAuthorUrl').value = result.lastFicAuthorUrl;
    });

    // --- Tab switching ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const tab = this.dataset.tab;
            if (tab) switchTab(tab);
        });
    });

    // --- Clear buttons ---
    document.querySelectorAll('[data-clear]').forEach(btn => {
        btn.addEventListener('click', function () {
            clearInput(this.dataset.clear);
        });
    });

    // --- Author tab ---
    document.getElementById('generateAuthorBtn')?.addEventListener('click', generateAuthorCSS);
    document.getElementById('authorAddBtn')?.addEventListener('click', addAuthorToBlockList);
    document.getElementById('blockAnonymousBtn')?.addEventListener('click', blockAnonymousFics);

    // --- Tags tab ---
    document.getElementById('fetchTagsBtn')?.addEventListener('click', fetchFicTags);
    document.getElementById('tagAddBtn')?.addEventListener('click', addSelectedTagsToBlockList);
    document.getElementById('selectAllTagsBtn')?.addEventListener('click', selectAllTags);
    document.getElementById('clearAllTagsBtn')?.addEventListener('click', clearAllTags);

    // --- Fics tab ---
    document.getElementById('fetchFicsBtn')?.addEventListener('click', fetchAuthorFics);
    document.getElementById('ficAddBtn')?.addEventListener('click', addSelectedFicsToBlockList);
    document.getElementById('selectAllFicsBtn')?.addEventListener('click', selectAllFics);
    document.getElementById('clearAllFicsBtn')?.addEventListener('click', clearAllFics);

    // --- Copy & Download ---
    document.querySelectorAll('[data-copy]').forEach(btn => {
        btn.addEventListener('click', function () {
            copyToClipboard(this.dataset.copy);
        });
    });
    document.querySelectorAll('[data-download]').forEach(btn => {
        btn.addEventListener('click', function () {
            downloadCSS(this.dataset.download, this.dataset.filename || 'ao3-blocker.css');
        });
    });

    // --- Delegated change events for checkboxes ---
    document.querySelector('#tagOutput')?.addEventListener('change', function (e) {
        if (e.target.classList.contains('tag-checkbox')) {
            updateTagCSS();
        }
    });
    document.querySelector('#fandosList')?.addEventListener('change', function (e) {
        if (e.target.classList.contains('fic-checkbox')) {
            updateFicsCSS();
        }
    });

    // --- Block Anonymous toggle ---
    const anonToggle = document.getElementById('blockAnonymousToggle');
    if (anonToggle) {
        chrome.storage.local.get(['blockAnonymous'], (result) => {
            anonToggle.checked = result.blockAnonymous === true;
        });
        anonToggle.addEventListener('change', function () {
            saveToStorage('blockAnonymous', this.checked);
            if (this.checked) {
                const css = `.blurb.work:not([class*="user-"]) { display: none !important; }`;
                document.getElementById('authorCssCode').textContent = css;
                document.getElementById('authorCssOutput').style.display = 'block';
                document.getElementById('authorCopyBtnGroup').style.display = 'flex';
            }
        });
    }

    // --- Render blocked lists ---
    renderBlockedAuthors();
    renderBlockedTags();
    renderBlockedFics();
    renderBlockedLanguages();
    updateStatsBar();

    // --- Export / Import ---
    document.getElementById('exportBtn')?.addEventListener('click', exportBlockList);
    document.getElementById('exportCssBtn')?.addEventListener('click', exportCSS);
    document.getElementById('importBtn')?.addEventListener('click', function () {
        document.getElementById('importFileInput').click();
    });
    document.getElementById('importFileInput')?.addEventListener('change', function (e) {
        if (this.files.length > 0) {
            importBlockList(this.files[0]);
            this.value = '';
        }
    });
});