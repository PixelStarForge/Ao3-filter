// content.js
let currentStyleId = 'ao3-filter-css';

// ---------- Inject custom styles ----------
function injectStyles() {
    const styleId = 'ao3-filter-inpage-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* Extension buttons */
        .ao3-filter-btn {
            background: #f0f0f0;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 4px 12px;
            font-size: 0.9em;
            cursor: pointer;
            color: #333;
            transition: background 0.2s, border-color 0.2s;
            white-space: nowrap;
            font-family: inherit;
        }
        .ao3-filter-btn:hover {
            background: #e0e0e0;
            border-color: #aaa;
        }
        .ao3-filter-actions {
            clear: both;
            padding: 1em 0em;
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
            justify-content: flex-start;
        }
        /* Tag popup */
        .ao3-filter-tag-popup {
            position: absolute;
            left: 0;
            right: 0;
            top: 100%;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 6px;
            padding: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-height: 240px;
            overflow-y: auto;
            z-index: 9999;
            width: 100%;
            box-sizing: border-box;
            margin-top: 4px;
        }
        .ao3-filter-tag-popup label {
            display: block;
            margin: 2px 0;
            cursor: pointer;
            font-size: 0.9em;
        }
        .ao3-filter-tag-popup label input {
            margin-right: 6px;
        }
        .ao3-filter-popup-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            margin-top: 8px;
        }
        .ao3-filter-popup-actions button {
            padding: 4px 12px;
            border-radius: 4px;
            border: 1px solid #ccc;
            background: #f0f0f0;
            cursor: pointer;
            font-family: inherit;
        }
        .ao3-filter-popup-actions .ao3-filter-block-btn {
            background: #8892f0;
            color: #fff;
            border-color: #6c7ae0;
        }
        .ao3-filter-popup-actions .ao3-filter-block-btn:hover {
            background: #6c7ae0;
        }
        .ao3-filter-popup-close {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            padding: 0 4px;
        }
        /* Custom confirm modal */
        .ao3-filter-confirm-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
        }
        .ao3-filter-confirm-box {
            background: #fff;
            padding: 20px 24px;
            border-radius: 8px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            color: #333;
        }
        .ao3-filter-confirm-box p {
            margin: 0 0 16px 0;
            font-size: 1em;
            line-height: 1.5;
        }
        .ao3-filter-confirm-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        .ao3-filter-confirm-actions button {
            padding: 6px 16px;
            border-radius: 4px;
            border: 1px solid #ccc;
            background: #f0f0f0;
            cursor: pointer;
            font-family: inherit;
        }
        .ao3-filter-confirm-actions .confirm-yes {
            background: #8892f0;
            color: #fff;
            border-color: #6c7ae0;
        }
        .ao3-filter-confirm-actions .confirm-yes:hover {
            background: #6c7ae0;
        }
        /* Dark mode */
        body.dark .ao3-filter-btn {
            background: #444;
            border-color: #666;
            color: #eee;
        }
        body.dark .ao3-filter-btn:hover {
            background: #555;
        }
        body.dark .ao3-filter-tag-popup {
            background: #333;
            border-color: #555;
            color: #eee;
        }
        body.dark .ao3-filter-popup-actions button {
            background: #444;
            border-color: #666;
            color: #eee;
        }
        body.dark .ao3-filter-popup-actions .ao3-filter-block-btn {
            background: #6c7ae0;
            border-color: #5a6ac8;
        }
        body.dark .ao3-filter-confirm-box {
            background: #2d2d2d;
            color: #eee;
        }
        body.dark .ao3-filter-confirm-actions button {
            background: #444;
            border-color: #666;
            color: #eee;
        }
        body.dark .ao3-filter-confirm-actions .confirm-yes {
            background: #6c7ae0;
            border-color: #5a6ac8;
        }
        /* Responsive */
        @media (max-width: 600px) {
            .ao3-filter-btn {
                font-size: 0.8em;
                padding: 3px 9px;
            }
            .ao3-filter-tag-popup {
                max-height: 180px;
                font-size: 0.85em;
            }
        }
    `;
    document.head.appendChild(style);
}

// ---------- Storage helpers ----------
function saveToStorage(key, value) {
    chrome.storage.local.set({ [key]: value });
}

function getFromStoragePromise(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key] || null);
        });
    });
}

// ---------- Generate CSS ----------
function generateCSSFromPrefs(prefs) {
    let css = '';
    if (prefs.blockAnonymous === true) {
        css += `.blurb.work:not([class*="user-"]) { display: none !important; }\n`;
    }
    if (prefs.blockedAuthors && Array.isArray(prefs.blockedAuthors)) {
        prefs.blockedAuthors.forEach(author => {
            css += `.blurb:has(a[href*="/users/${author}/pseuds"]) { display: none !important; }\n`;
        });
    }
    if (prefs.blockedTags && Array.isArray(prefs.blockedTags)) {
        prefs.blockedTags.forEach(tag => {
            const encoded = tag.encoded || tag;
            css += `.blurb:has(a[href*="${encoded}"]) { display: none !important; }\n`;
        });
    }
    if (prefs.blockedFics && Array.isArray(prefs.blockedFics)) {
        prefs.blockedFics.forEach(fic => {
            const id = fic.id || fic;
            css += `.blurb.work[id*="work_${id}"] { display: none !important; }\n`;
        });
    }
    if (prefs.blockedLanguages && Array.isArray(prefs.blockedLanguages)) {
        prefs.blockedLanguages.forEach(lang => {
            css += `li.work.blurb:has(dl.stats dd.language[lang="${lang.code}"]) { display: none !important; }\n`;
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

// ---------- Update filters ----------
async function updateFilters() {
    const result = await chrome.storage.local.get(['blockedAuthors', 'blockedTags', 'blockedFics', 'blockAnonymous', 'blockedLanguages']);
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
    let languages = result.blockedLanguages || [];
    if (typeof languages === 'string') {
        try { languages = JSON.parse(languages); } catch (e) { languages = []; }
    }
    const prefs = {
        blockedAuthors: authors,
        blockedTags: tags,
        blockedFics: fics,
        blockedLanguages: languages,
        blockAnonymous: result.blockAnonymous === true
    };
    const css = generateCSSFromPrefs(prefs);
    injectCSS(css);
}

// ---------- Add to blocked (for authors, tags, fics) ----------
async function addToBlocked(type, items) {
    const keyMap = {
        'author': 'blockedAuthors',
        'tag': 'blockedTags',
        'fic': 'blockedFics'
    };
    const key = keyMap[type];
    if (!key) return;
    const existing = await getFromStoragePromise(key);
    let list = [];
    if (typeof existing === 'string') {
        try { list = JSON.parse(existing); } catch (e) { list = []; }
    } else if (Array.isArray(existing)) {
        list = existing;
    }
    if (type === 'author') {
        items.forEach(item => {
            if (!list.includes(item)) list.push(item);
        });
    } else if (type === 'tag') {
        items.forEach(item => {
            const exists = list.some(t => t.encoded === item.encoded);
            if (!exists) list.push(item);
        });
    } else if (type === 'fic') {
        items.forEach(item => {
            const exists = list.some(f => f.id === item.id);
            if (!exists) list.push(item);
        });
    }
    saveToStorage(key, JSON.stringify(list));
    await updateFilters();
}

// ---------- Language blocking ----------
async function addBlockedLanguage(code, display) {
    const key = 'blockedLanguages';
    const existing = await getFromStoragePromise(key);
    let list = [];
    if (typeof existing === 'string') {
        try { list = JSON.parse(existing); } catch (e) { list = []; }
    } else if (Array.isArray(existing)) {
        list = existing;
    }
    if (!list.some(l => l.code === code)) {
        list.push({ code, display });
        saveToStorage(key, JSON.stringify(list));
        await updateFilters();
    }
}

async function removeBlockedLanguage(code) {
    const key = 'blockedLanguages';
    const existing = await getFromStoragePromise(key);
    let list = [];
    if (typeof existing === 'string') {
        try { list = JSON.parse(existing); } catch (e) { list = []; }
    } else if (Array.isArray(existing)) {
        list = existing;
    }
    list = list.filter(l => l.code !== code);
    saveToStorage(key, JSON.stringify(list));
    await updateFilters();
}

// ---------- Hide blurb ----------
function hideBlurb(blurb) {
    if (blurb) blurb.style.display = 'none';
}

// ---------- Extract data from blurb ----------
function getBlurbData(blurb) {
    const authorLink = blurb.querySelector('a[rel="author"]');
    const authorName = authorLink ? authorLink.textContent.trim() : null;
    const idMatch = blurb.id && blurb.id.match(/work_(\d+)/);
    const workId = idMatch ? idMatch[1] : null;
    const titleLink = blurb.querySelector('h4.heading > a');
    const title = titleLink ? titleLink.textContent.trim() : null;

    const tagItems = blurb.querySelectorAll('ul.tags.commas li');
    const groupedTags = {};
    tagItems.forEach(li => {
        const cat = li.className.replace('tags', '').trim() || 'freeforms';
        const link = li.querySelector('a.tag');
        if (link) {
            const href = link.getAttribute('href');
            const match = href && href.match(/\/tags\/([^\/]+)\/works/);
            if (match) {
                const encoded = match[1];
                if (!groupedTags[cat]) groupedTags[cat] = [];
                groupedTags[cat].push({
                    encoded: encoded,
                    display: link.textContent.trim()
                });
            }
        }
    });

    const langElement = blurb.querySelector('dl.stats dd.language');
    let language = null;
    if (langElement) {
        const langCode = langElement.getAttribute('lang') || 'en';
        const langDisplay = langElement.textContent.trim();
        language = { code: langCode, display: langDisplay };
    }

    return { authorName, workId, title, tags: groupedTags, language };
}

// ---------- Custom confirm modal ----------
function showConfirm(message, onConfirm, onCancel) {
    const overlay = document.createElement('div');
    overlay.className = 'ao3-filter-confirm-overlay';
    overlay.innerHTML = `
        <div class="ao3-filter-confirm-box">
            <p>${message}</p>
            <div class="ao3-filter-confirm-actions">
                <button class="confirm-no">Cancel</button>
                <button class="confirm-yes">Yes</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const yesBtn = overlay.querySelector('.confirm-yes');
    const noBtn = overlay.querySelector('.confirm-no');

    const cleanup = () => overlay.remove();

    yesBtn.addEventListener('click', () => {
        cleanup();
        if (onConfirm) onConfirm();
    });
    noBtn.addEventListener('click', () => {
        cleanup();
        if (onCancel) onCancel();
    });
    // Click outside the box closes (cancel)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            cleanup();
            if (onCancel) onCancel();
        }
    });
}

// ---------- Tag popup with outside click close ----------
let currentPopup = null;

function openTagPopup(blurb, data) {
    const groupedTags = data.tags;
    // Remove existing popup
    if (currentPopup) {
        currentPopup.remove();
        currentPopup = null;
    }

    // Ensure blurb has position:relative
    if (getComputedStyle(blurb).position === 'static') {
        blurb.style.position = 'relative';
    }

    const popup = document.createElement('div');
    popup.className = 'ao3-filter-tag-popup';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-weight: bold;';
    header.innerHTML = `<span>Block Tags</span><button class="ao3-filter-popup-close">✕</button>`;
    popup.appendChild(header);

    // Tag list
    const tagList = document.createElement('div');
    const categories = ['warnings', 'characters', 'relationships', 'freeforms'];
    const catLabels = {
        'warnings': '⚠️ Warnings',
        'characters': '👤 Characters',
        'relationships': '💕 Relationships',
        'freeforms': '🏷️ Additional Tags'
    };
    let hasTags = false;
    categories.forEach(cat => {
        const tags = groupedTags[cat] || [];
        if (tags.length === 0) return;
        hasTags = true;
        const catDiv = document.createElement('div');
        catDiv.style.marginBottom = '4px';
        const label = document.createElement('div');
        label.style.fontWeight = 'bold';
        label.style.fontSize = '0.85em';
        label.textContent = catLabels[cat] || cat;
        catDiv.appendChild(label);
        tags.forEach(tag => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = tag.encoded;
            checkbox.dataset.display = tag.display;
            const span = document.createElement('span');
            span.textContent = tag.display;
            const wrapper = document.createElement('label');
            wrapper.style.display = 'block';
            wrapper.style.marginLeft = '8px';
            wrapper.appendChild(checkbox);
            wrapper.appendChild(span);
            catDiv.appendChild(wrapper);
        });
        tagList.appendChild(catDiv);
    });
    if (!hasTags) {
        const empty = document.createElement('div');
        empty.textContent = 'No tags found.';
        tagList.appendChild(empty);
    }
    popup.appendChild(tagList);

    // ---------- Language blocker section (checkbox) ----------
    if (data.language) {
        const langSection = document.createElement('div');
        langSection.style.marginTop = '10px';
        const langLabel = document.createElement('div');
        langLabel.style.fontWeight = 'bold';
        langLabel.style.fontSize = '0.85em';
        langLabel.textContent = 'Block Language:';
        langSection.appendChild(langLabel);

        const langCheckbox = document.createElement('input');
        langCheckbox.type = 'checkbox';
        langCheckbox.id = 'ao3-filter-lang-block';
        const langSpan = document.createElement('span');
        langSpan.textContent = `Block all works in "${data.language.display}" (${data.language.code})`;
        const langWrapper = document.createElement('label');
        langWrapper.style.display = 'block';
        langWrapper.style.margin = '4px 0';
        langWrapper.appendChild(langCheckbox);
        langWrapper.appendChild(langSpan);
        langSection.appendChild(langWrapper);
        popup.appendChild(langSection);
    } else {
        const msg = document.createElement('div');
        msg.style.marginTop = '10px';
        msg.style.fontStyle = 'italic';
        msg.textContent = 'No language information available.';
        popup.appendChild(msg);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'ao3-filter-popup-actions';
    const blockBtn = document.createElement('button');
    blockBtn.textContent = 'Hide Selected';
    blockBtn.className = 'ao3-filter-block-btn';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    actions.appendChild(blockBtn);
    actions.appendChild(cancelBtn);
    popup.appendChild(actions);

    // Insert popup after stats
    const stats = blurb.querySelector('dl.stats');
    if (stats) {
        stats.parentNode.insertBefore(popup, stats.nextSibling);
    } else {
        blurb.appendChild(popup);
    }

    currentPopup = popup;

    // Close function
    const closePopup = () => {
        if (currentPopup) {
            currentPopup.remove();
            currentPopup = null;
        }
        document.removeEventListener('click', outsideClickListener);
    };

    // Outside click listener
    const outsideClickListener = (e) => {
        if (currentPopup && !currentPopup.contains(e.target) && !blurb.contains(e.target)) {
            // Also ensure click isn't on the tags button itself (to avoid immediate reopen)
            const tagsBtn = blurb.querySelector('.ao3-filter-btn:nth-child(2)');
            if (tagsBtn && tagsBtn.contains(e.target)) return;
            closePopup();
        }
    };
    // Delay adding listener to avoid immediate trigger
    setTimeout(() => {
        document.addEventListener('click', outsideClickListener);
    }, 10);

    // Close button
    const closeBtn = popup.querySelector('.ao3-filter-popup-close');
    closeBtn.addEventListener('click', closePopup);

    // Cancel button
    cancelBtn.addEventListener('click', closePopup);

    // Block button
    blockBtn.addEventListener('click', () => {
        const checked = popup.querySelectorAll('input[type="checkbox"]:checked');
        const langCheckbox = popup.querySelector('#ao3-filter-lang-block');
        const blockLanguage = langCheckbox && langCheckbox.checked && data.language;

        const tagsToBlock = [];
        checked.forEach(cb => {
            // Exclude the language checkbox from tag list
            if (cb.id !== 'ao3-filter-lang-block') {
                tagsToBlock.push({
                    encoded: cb.value,
                    display: cb.dataset.display,
                    category: 'freeforms'
                });
            }
        });

        if (tagsToBlock.length === 0 && !blockLanguage) {
            alert('No tags or language selected.');
            return;
        }

        // Build confirmation message
        let confirmMsg = '';
        if (tagsToBlock.length > 0) {
            confirmMsg += `Hide ${tagsToBlock.length} tag(s)`;
        }
        if (blockLanguage) {
            if (confirmMsg) confirmMsg += ' and ';
            confirmMsg += `hide all works in "${data.language.display}"`;
        }
        confirmMsg += '?';

        showConfirm(confirmMsg, () => {
            if (tagsToBlock.length > 0) {
                addToBlocked('tag', tagsToBlock);
            }
            if (blockLanguage) {
                addBlockedLanguage(data.language.code, data.language.display);
            }
            hideBlurb(blurb);
            closePopup();
        });
    });
}

// ---------- Inject anonymous toggle into top navigation ----------
function injectAnonymousToggle() {
    // Check if already injected
    if (document.getElementById('ao3-anon-toggle-item')) return;

    const navLists = document.querySelectorAll('ul.user.navigation.actions');
    let targetList = null;
    navLists.forEach(ul => {
        if (targetList) return;
        const hasWorksLink = ul.querySelector('a[href="/works"]');
        const firstLi = ul.querySelector('li');
        const firstLiText = firstLi ? firstLi.textContent.trim() : '';
        if (hasWorksLink || firstLiText === 'Works') {
            targetList = ul;
        }
    });
    if (!targetList) return;

    const li = document.createElement('li');
    li.id = 'ao3-anon-toggle-item';

    const button = document.createElement('button');
    button.className = 'ao3-filter-btn';
    button.id = 'ao3-anon-toggle';
    chrome.storage.local.get(['blockAnonymous'], (result) => {
        const isBlocking = result.blockAnonymous === true;
        button.textContent = isBlocking ? 'Show Anonymous' : 'Hide Anonymous';
    });
    button.addEventListener('click', () => {
        chrome.storage.local.get(['blockAnonymous'], (result) => {
            const newValue = !(result.blockAnonymous === true);
            saveToStorage('blockAnonymous', newValue);
            button.textContent = newValue ? 'Show Anonymous' : 'Hide Anonymous';
            updateFilters();
        });
    });

    li.appendChild(button);
    targetList.appendChild(li);
}

// ---------- Inject action buttons into each blurb ----------
function injectActionButtons(blurb) {
    if (blurb.dataset.ao3FilterInjected) return;
    blurb.dataset.ao3FilterInjected = 'true';

    const data = getBlurbData(blurb);
    if (!data.workId) return;

    const stats = blurb.querySelector('dl.stats');
    if (!stats) return;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'ao3-filter-actions';

    // Author button
    const authorBtn = document.createElement('button');
    authorBtn.className = 'ao3-filter-btn';
    authorBtn.textContent = 'Hide Author';
    authorBtn.title = 'Hide this author';
    authorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (data.authorName) {
            showConfirm(`Hide all works by "${data.authorName}"?`, () => {
                addToBlocked('author', [data.authorName]);
                hideBlurb(blurb);
            });
        }
    });
    actionsDiv.appendChild(authorBtn);

    // Tags button
    const tagsBtn = document.createElement('button');
    tagsBtn.className = 'ao3-filter-btn';
    tagsBtn.textContent = 'Hide Tags';
    tagsBtn.title = 'Hide selected tags from this work';
    tagsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openTagPopup(blurb, data);
    });
    actionsDiv.appendChild(tagsBtn);

    // Work button
    const workBtn = document.createElement('button');
    workBtn.className = 'ao3-filter-btn';
    workBtn.textContent = 'Hide Work';
    workBtn.title = 'Hide this work';
    workBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (data.workId) {
            showConfirm(`Hide "${data.title || 'this work'}"? by "${data.authorName || 'Unknown Author'}"`, () => {
                addToBlocked('fic', [{ id: data.workId, title: data.title || 'Untitled' }]);
                hideBlurb(blurb);
            });
        }
    });
    actionsDiv.appendChild(workBtn);

    // Insert after stats
    stats.parentNode.insertBefore(actionsDiv, stats.nextSibling);
}

// ---------- Main injection ----------
function injectAll() {
    injectStyles();
    injectAnonymousToggle();
    const blurbs = document.querySelectorAll('li.work.blurb');
    blurbs.forEach(blurb => {
        injectActionButtons(blurb);
    });
}

// ---------- Run ----------
document.addEventListener('DOMContentLoaded', () => {
    updateFilters();
    injectAll();
});

// Also run after load (for any dynamic changes)
window.addEventListener('load', () => {
    // If not already injected, do it now
    if (!document.querySelector('.ao3-filter-actions')) {
        injectAll();
    }
});

// Storage change listener
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        const relevantKeys = ['blockedAuthors', 'blockedTags', 'blockedFics', 'blockAnonymous', 'blockedLanguages'];
        if (Object.keys(changes).some(key => relevantKeys.includes(key))) {
            updateFilters();
        }
    }
});

// Message listener for popup injection
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'injectCSS' && request.css) {
        injectCSS(request.css);
        sendResponse({ success: true });
    }
});