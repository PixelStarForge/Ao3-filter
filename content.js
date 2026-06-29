// content.js
let currentStyleId = 'ao3-filter-css';

function generateCSSFromPrefs(prefs) {
    let css = '';

    // Block anonymous fics (if enabled)
    if (prefs.blockAnonymous === true) {
        css += `.blurb.work:not([class*="user-"]) { display: none !important; }\n`;
    }

    // Block authors – stored as array
    if (prefs.blockedAuthors && Array.isArray(prefs.blockedAuthors)) {
        prefs.blockedAuthors.forEach(author => {
            css += `.blurb:has(a[href*="/users/${author}/pseuds"]) { display: none !important; }\n`;
        });
    }

    // Block tags – stored as array of objects { encoded, display, category }
    if (prefs.blockedTags && Array.isArray(prefs.blockedTags)) {
        prefs.blockedTags.forEach(tag => {
            const encoded = tag.encoded || tag;
            css += `.blurb:has(a[href*="${encoded}"]) { display: none !important; }\n`;
        });
    }

    // Block fics – stored as array of objects { id, title }
    if (prefs.blockedFics && Array.isArray(prefs.blockedFics)) {
        prefs.blockedFics.forEach(fic => {
            const id = fic.id || fic;
            css += `.blurb.work[id*="work_${id}"] { display: none !important; }\n`;
        });
    }

    return css;
}

function injectCSS(css) {
    const oldStyle = document.getElementById(currentStyleId);
    if (oldStyle) oldStyle.remove();

    if (!css) return;

    const style = document.createElement('style');
    style.id = currentStyleId;
    style.textContent = css;
    document.head.appendChild(style);
}

async function updateFilters() {
    const result = await chrome.storage.local.get(['blockedAuthors', 'blockedTags', 'blockedFics', 'blockAnonymous']);

    // Parse stored data if they're strings (backward compatibility)
    let authors = result.blockedAuthors || [];
    if (typeof authors === 'string') {
        try { authors = JSON.parse(authors); } catch (e) { authors = []; }
    }

    let tags = result.blockedTags || [];
    if (typeof tags === 'string') {
        try { tags = JSON.parse(tags); } catch (e) { tags = []; }
    }

    let fics = result.blockedFics || [];
    if (typeof fics === 'string') {
        try { fics = JSON.parse(fics); } catch (e) { fics = []; }
    }

    const prefs = {
        blockedAuthors: authors,
        blockedTags: tags,
        blockedFics: fics,
        blockAnonymous: result.blockAnonymous === true
    };

    const css = generateCSSFromPrefs(prefs);
    injectCSS(css);
}

// Run on page load
updateFilters();

// Listen for changes in storage
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        const relevantKeys = ['blockedAuthors', 'blockedTags', 'blockedFics', 'blockAnonymous'];
        if (Object.keys(changes).some(key => relevantKeys.includes(key))) {
            updateFilters();
        }
    }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'injectCSS' && request.css) {
        injectCSS(request.css);
        sendResponse({ success: true });
    }
});

document.addEventListener('DOMContentLoaded', updateFilters);