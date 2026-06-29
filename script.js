// ========================
//  STORAGE HELPERS
// ========================

function decodeHTML(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

function saveToStorage(key, value) {
    chrome.storage.local.set({ [key]: value });
}

function getFromStorage(key, callback) {
    chrome.storage.local.get([key], (result) => {
        callback(result[key] || null);
    });
}

function getFromStoragePromise(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key] || null);
        });
    });
}

// ========================
//  DARK MODE
// ========================

function isDarkModeEnabled() {
    return !document.body.classList.contains('light');
}

function setDarkMode(dark) {
    if (dark) {
        document.body.classList.remove('light');
        document.getElementById('darkModeToggle').textContent = '🌙';
    } else {
        document.body.classList.add('light');
        document.getElementById('darkModeToggle').textContent = '☀️';
    }
    saveToStorage('darkMode', String(dark));
}

function toggleDarkMode() {
    setDarkMode(!isDarkModeEnabled());
}

// ========================
//  BLOCK LIST MANAGEMENT
// ========================

// Storage structure:
// blockedAuthors: ["username1", "username2"]
// blockedTags: [{ encoded: "tag1", display: "Tag Name", category: "warnings" }, ...]
// blockedFics: [{ id: "12345", title: "Fic Title" }, ...]
// blockAnonymous: true/false

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

    // Add items, avoiding duplicates
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
    // Re-render the list UI
    if (type === 'author') renderBlockedAuthors();
    else if (type === 'tag') renderBlockedTags();
    else if (type === 'fic') renderBlockedFics();
}

async function removeFromBlocked(type, value) {
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
        list = list.filter(item => item !== value);
    } else if (type === 'tag') {
        list = list.filter(item => item.encoded !== value);
    } else if (type === 'fic') {
        list = list.filter(item => item.id !== value);
    }

    saveToStorage(key, JSON.stringify(list));
    if (type === 'author') renderBlockedAuthors();
    else if (type === 'tag') renderBlockedTags();
    else if (type === 'fic') renderBlockedFics();
    showToast(`${type} removed`, 'info');
}

// ========================
//  FETCH HELPERS
// ========================

async function fetchPageHTML(url) {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }
    return await response.text();
}

// ========================
//  TOAST / MESSAGE HELPERS
// ========================

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showMessage(element, text, type) {
    element.textContent = text;
    element.className = `message show ${type}`;
    setTimeout(() => element.classList.remove('show'), 4000);
}

function copyToClipboard(elementId) {
    const text = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Failed to copy', 'error');
    });
}

function downloadCSS(elementId, filename) {
    const css = document.getElementById(elementId).textContent;
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(css));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast('Downloaded ' + filename, 'success');
}

// ========================
//  TAB SWITCH
// ========================

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
}

// ========================
//  CLEAR INPUT
// ========================

function clearInput(inputId) {
    document.getElementById(inputId).value = '';
    document.getElementById(inputId).focus();
}

// ========================
//  AUTHOR BLOCKER
// ========================

async function generateAuthorCSS() {
    const url = document.getElementById('authorUrl').value.trim();
    const message = document.getElementById('authorMessage');
    const spinner = document.getElementById('authorSpinner');
    const btn = spinner.parentElement;

    message.classList.remove('show');

    if (!url) {
        showMessage(message, 'Please enter an author URL', 'error');
        return;
    }

    const match = url.match(/\/users\/([^\/]+)/);
    if (!match || !match[1]) {
        showMessage(message, 'Invalid URL format', 'error');
        return;
    }

    const username = match[1];
    spinner.style.display = 'inline-block';
    btn.disabled = true;

    try {
        const css = `.blurb:has(a[href*="/users/${username}/pseuds"]) { display: none !important; }`;
        document.getElementById('authorCssCode').textContent = css;
        document.getElementById('authorCssOutput').style.display = 'block';
        document.getElementById('authorCopyBtnGroup').style.display = 'flex';
        document.getElementById('authorAddBtnGroup').style.display = 'flex';
        // Store the username for the "Add to Block List" button
        document.getElementById('authorAddBtn').dataset.username = username;
        showToast(`CSS generated for @${username}`, 'success');
        saveToStorage('lastAuthorUrl', url);
    } catch (error) {
        showMessage(message, `Error: ${error.message}`, 'error');
    } finally {
        spinner.style.display = 'none';
        btn.disabled = false;
    }
}

function addAuthorToBlockList() {
    const username = document.getElementById('authorAddBtn').dataset.username;
    if (!username) {
        showToast('No author to add', 'error');
        return;
    }
    addToBlocked('author', [username]);
    showToast(`Added @${username} to block list`, 'success');
}

function blockAnonymousFics() {
    const css = `.blurb.work:not([class*="user-"]) {\n  display: none !important;\n}`;
    document.getElementById('authorCssCode').textContent = css;
    document.getElementById('authorCssOutput').style.display = 'block';
    document.getElementById('authorCopyBtnGroup').style.display = 'flex';
    showToast('CSS generated to hide anonymous fics', 'success');
    // Save preference
    saveToStorage('blockAnonymous', true);
    const toggle = document.getElementById('blockAnonymousToggle');
    if (toggle) toggle.checked = true;
}

// ========================
//  TAG BLOCKER
// ========================

let currentTags = [];

async function fetchFicTags() {
    const url = document.getElementById('ficUrl').value.trim();
    const message = document.getElementById('tagsMessage');
    const spinner = document.getElementById('tagsSpinner');
    const btn = spinner.parentElement;

    message.classList.remove('show');

    if (!url) {
        showMessage(message, 'Please enter a fic URL', 'error');
        return;
    }

    spinner.style.display = 'inline-block';
    btn.disabled = true;

    try {
        const html = await fetchPageHTML(url);
        const metadataMatch = html.match(/<dl class="work meta group">([\s\S]*?)<\/dl>/);
        const metadata = metadataMatch ? metadataMatch[0] : html;

        const warnings = extractTagsByClass(metadata, 'warning', 'warnings');
        const relationships = extractTagsByClass(metadata, 'relationship', 'relationships');
        const characters = extractTagsByClass(metadata, 'character', 'characters');
        const freeforms = extractTagsByClass(metadata, 'freeform', 'freeforms');

        currentTags = [...warnings, ...relationships, ...characters, ...freeforms];

        displayTagCategory('tagsWarningsSection', '⚠️ Warnings', warnings);
        displayTagCategory('tagsRelationshipsSection', '💕 Relationships', relationships);
        displayTagCategory('tagsCharactersSection', '👤 Characters', characters);
        displayTagCategory('tagsExtraSection', '🏷️ Additional Tags', freeforms);

        document.getElementById('tagOutput').style.display = 'block';
        document.getElementById('tagAddBtnGroup').style.display = 'none';
        showToast('Tags loaded', 'success');
        saveToStorage('lastFicUrl', url);
    } catch (error) {
        showMessage(message, `Error: ${error.message}`, 'error');
    } finally {
        spinner.style.display = 'none';
        btn.disabled = false;
    }
}

function extractTagsByClass(metadata, className, category) {
    const tags = [];
    const regex = new RegExp(`<dd class="${className}[^"]*"[^>]*>([\\s\\S]*?)<\\/dd>`, "i");
    const match = regex.exec(metadata);
    if (!match) return tags;

    const content = match[1];
    const tagRegex = /<a class="tag" href="\/tags\/([^"]+)\/works">([^<]+)<\/a>/g;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(content)) !== null) {
        tags.push({
            encoded: tagMatch[1],
            display: decodeHTML(tagMatch[2]),
            category: category
        });
    }
    return tags;
}

function displayTagCategory(sectionId, title, tags) {
    const section = document.getElementById(sectionId);
    while (section.firstChild) {
        section.removeChild(section.firstChild);
    }
    if (tags.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-message';
        empty.textContent = 'No tags found';
        section.appendChild(empty);
        return;
    }

    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'tag-category';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'tag-category-title';
    titleDiv.textContent = title;
    categoryDiv.appendChild(titleDiv);

    const listDiv = document.createElement('div');
    listDiv.className = 'tag-list';

    tags.forEach(tag => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'tag-checkbox';
        checkbox.value = tag.encoded;
        checkbox.dataset.tag = tag.display;
        checkbox.dataset.category = tag.category;
        const span = document.createElement('span');
        span.textContent = tag.display;
        label.appendChild(checkbox);
        label.appendChild(span);
        listDiv.appendChild(label);
    });

    categoryDiv.appendChild(listDiv);
    section.appendChild(categoryDiv);
}

function updateTagCSS() {
    const checkboxes = document.querySelectorAll('.tag-checkbox');
    const selected = Array.from(checkboxes).filter(cb => cb.checked);
    let css = '';
    selected.forEach(cb => {
        css += `.blurb:has(a[href*="${cb.value}"]) { display: none !important; }\n\n`;
    });
    document.getElementById('tagsCssCode').textContent = css || '/* Select tags to generate CSS */';

    // Update stats
    const stats = document.getElementById('tagsStats');
    while (stats.firstChild) {
        stats.removeChild(stats.firstChild);
    }
    const item1 = document.createElement('div');
    item1.className = 'stat-item';
    item1.innerHTML = `Selected: <span class="stat-value">${selected.length}</span> tag(s)`;
    const item2 = document.createElement('div');
    item2.className = 'stat-item';
    item2.innerHTML = `CSS rules: <span class="stat-value">${selected.length}</span>`;
    stats.appendChild(item1);
    stats.appendChild(item2);

    document.getElementById('tagsCopyBtnGroup').style.display = selected.length > 0 ? 'flex' : 'none';
    document.getElementById('tagAddBtnGroup').style.display = selected.length > 0 ? 'flex' : 'none';
}

function addSelectedTagsToBlockList() {
    const checkboxes = document.querySelectorAll('.tag-checkbox:checked');
    if (checkboxes.length === 0) {
        showToast('No tags selected', 'error');
        return;
    }
    const tags = Array.from(checkboxes).map(cb => ({
        encoded: cb.value,
        display: cb.dataset.tag,
        category: cb.dataset.category
    }));
    addToBlocked('tag', tags);
    showToast(`Added ${tags.length} tag(s) to block list`, 'success');
}

function selectAllTags() {
    document.querySelectorAll('.tag-checkbox').forEach(cb => cb.checked = true);
    updateTagCSS();
}

function clearAllTags() {
    document.querySelectorAll('.tag-checkbox').forEach(cb => cb.checked = false);
    updateTagCSS();
}

// ========================
//  FIC BLOCKER
// ========================

let allFics = {};

async function fetchAuthorFics() {
    const url = document.getElementById('ficAuthorUrl').value.trim();
    const message = document.getElementById('ficsMessage');
    const spinner = document.getElementById('ficsSpinner');
    const btn = spinner.parentElement;

    message.classList.remove('show');

    if (!url) {
        showMessage(message, 'Please enter an author URL', 'error');
        return;
    }

    const match = url.match(/\/users\/([^\/]+)/);
    if (!match || !match[1]) {
        showMessage(message, 'Invalid URL format', 'error');
        return;
    }

    const username = match[1];
    const worksUrl = `https://archiveofourown.org/users/${username}/pseuds/${username}/works`;

    spinner.style.display = 'inline-block';
    btn.disabled = true;

    try {
        const html = await fetchPageHTML(worksUrl);

        const workBlockRegex = /<li id="work_(\d+)"[^>]*>[\s\S]*?<h4 class="heading">\s*<a[^>]*>([^<]+)<\/a>[\s\S]*?<h5 class="fandoms heading"[^>]*>([\s\S]*?)<\/h5>/gm;
        const fandoms = {};
        let match2;
        let workCount = 0;

        while ((match2 = workBlockRegex.exec(html)) !== null) {
            const workId = match2[1];
            const title = match2[2].trim();
            const fandomHtml = match2[3];
            const fandomMatch = fandomHtml.match(/<a class="tag"[^>]*>([^<]+)<\/a>/);
            const fandom = fandomMatch ? fandomMatch[1].trim() : 'Other';

            if (!fandoms[fandom]) fandoms[fandom] = [];
            fandoms[fandom].push({ id: workId, title: title });
            workCount++;
        }

        if (workCount === 0) {
            throw new Error('No works found - author may have no public works');
        }

        allFics = fandoms;
        displayFandoms();
        document.getElementById('ficsOutput').style.display = 'block';
        document.getElementById('ficAddBtnGroup').style.display = 'none';
        showToast(`Loaded ${workCount} fic(s)`, 'success');
        saveToStorage('lastFicAuthorUrl', url);
    } catch (error) {
        showMessage(message, `Error: ${error.message}`, 'error');
    } finally {
        spinner.style.display = 'none';
        btn.disabled = false;
    }
}

function displayFandoms() {
    const container = document.getElementById('fandosList');
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    Object.entries(allFics).forEach(([fandom, fics]) => {
        const section = document.createElement('div');
        section.className = 'fandom-section';

        const header = document.createElement('div');
        header.className = 'fandom-header';
        header.textContent = `${fandom} (${fics.length})`;
        header.onclick = () => toggleFandom(section);

        const list = document.createElement('div');
        list.className = 'fandom-list';
        list.style.display = 'grid';

        fics.forEach(fic => {
            const label = document.createElement('label');
            label.className = 'fic-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'fic-checkbox';
            checkbox.value = fic.id;
            checkbox.dataset.title = fic.title;
            const span = document.createElement('span');
            span.textContent = fic.title;
            label.appendChild(checkbox);
            label.appendChild(span);
            list.appendChild(label);
        });

        section.appendChild(header);
        section.appendChild(list);
        container.appendChild(section);
    });

    updateFicsCSS();

    const searchInput = document.getElementById('ficsSearchInput');
    searchInput.oninput = function () {
        const query = this.value.toLowerCase();

        if (!query) {
            document.querySelectorAll('.fandom-section').forEach(section => {
                section.style.display = 'block';
                section.querySelector('.fandom-list').style.display = 'grid';
                section.querySelectorAll('.fic-item').forEach(label => {
                    label.style.display = 'flex';
                });
            });
            return;
        }

        document.querySelectorAll('.fandom-section').forEach(section => {
            const fandomName = section.querySelector('.fandom-header').textContent;
            const labels = section.querySelectorAll('.fic-item');
            const ficTitles = Array.from(labels).map(l => l.textContent.trim());

            const matchingFics = fuzzySearch(query, ficTitles);

            if (matchingFics.length > 0) {
                section.style.display = 'block';
                labels.forEach(label => {
                    const title = label.textContent.trim();
                    label.style.display = matchingFics.includes(title) ? 'flex' : 'none';
                });
            } else if (fandomName.toLowerCase().includes(query)) {
                section.style.display = 'block';
                labels.forEach(label => label.style.display = 'flex');
            } else {
                section.style.display = 'none';
            }
        });
    };
}

function toggleFandom(section) {
    const list = section.querySelector('.fandom-list');
    list.style.display = list.style.display === 'none' ? 'grid' : 'none';
}

function updateFicsCSS() {
    const checkboxes = document.querySelectorAll('.fic-checkbox');
    const selected = Array.from(checkboxes).filter(cb => cb.checked);
    let css = '';
    selected.forEach(cb => {
        css += `.blurb.work[id*="work_${cb.value}"] { display: none !important; }\n`;
    });
    document.getElementById('ficsCssCode').textContent = css || '/* Select fics to generate CSS */';

    const stats = document.getElementById('ficsStats');
    while (stats.firstChild) {
        stats.removeChild(stats.firstChild);
    }
    const item1 = document.createElement('div');
    item1.className = 'stat-item';
    item1.innerHTML = `Selected: <span class="stat-value">${selected.length}</span> fic(s)`;
    const item2 = document.createElement('div');
    item2.className = 'stat-item';
    item2.innerHTML = `CSS rules: <span class="stat-value">${selected.length}</span>`;
    stats.appendChild(item1);
    stats.appendChild(item2);

    document.getElementById('ficsCopyBtnGroup').style.display = selected.length > 0 ? 'flex' : 'none';
    document.getElementById('ficAddBtnGroup').style.display = selected.length > 0 ? 'flex' : 'none';
}

function addSelectedFicsToBlockList() {
    const checkboxes = document.querySelectorAll('.fic-checkbox:checked');
    if (checkboxes.length === 0) {
        showToast('No fics selected', 'error');
        return;
    }
    const fics = Array.from(checkboxes).map(cb => ({
        id: cb.value,
        title: cb.dataset.title
    }));
    addToBlocked('fic', fics);
    showToast(`Added ${fics.length} fic(s) to block list`, 'success');
}

function selectAllFics() {
    document.querySelectorAll('.fic-checkbox').forEach(cb => cb.checked = true);
    updateFicsCSS();
}

function clearAllFics() {
    document.querySelectorAll('.fic-checkbox').forEach(cb => cb.checked = false);
    updateFicsCSS();
}

// ========================
//  RENDER BLOCKED LISTS (UI)
// ========================

async function renderBlockedAuthors() {
    const container = document.getElementById('blockedAuthorsList');
    if (!container) return;
    const data = await getFromStoragePromise('blockedAuthors');
    let list = [];
    if (typeof data === 'string') {
        try { list = JSON.parse(data); } catch (e) { list = []; }
    } else if (Array.isArray(data)) {
        list = data;
    }

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (list.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-message';
        empty.textContent = 'No authors blocked.';
        container.appendChild(empty);
        return;
    }

    list.forEach(author => {
        const chip = document.createElement('span');
        chip.className = 'blocked-chip';
        chip.innerHTML = `${author} <button class="remove-chip" data-type="author" data-value="${author}">✕</button>`;
        container.appendChild(chip);
    });

    container.querySelectorAll('.remove-chip').forEach(btn => {
        btn.addEventListener('click', function () {
            removeFromBlocked('author', this.dataset.value);
        });
    });
}

async function renderBlockedTags() {
    const container = document.getElementById('blockedTagsList');
    if (!container) return;
    const data = await getFromStoragePromise('blockedTags');
    let list = [];
    if (typeof data === 'string') {
        try { list = JSON.parse(data); } catch (e) { list = []; }
    } else if (Array.isArray(data)) {
        list = data;
    }

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (list.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-message';
        empty.textContent = 'No tags blocked.';
        container.appendChild(empty);
        return;
    }

    // Group by category
    const categories = {};
    list.forEach(tag => {
        const cat = tag.category || 'other';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(tag);
    });

    const catNames = {
        'warnings': '⚠️ Warnings',
        'relationships': '💕 Relationships',
        'characters': '👤 Characters',
        'freeforms': '🏷️ Additional Tags',
        'other': '📌 Other'
    };

    Object.entries(categories).forEach(([cat, tags]) => {
        const catDiv = document.createElement('div');
        catDiv.className = 'blocked-category';

        const catTitle = document.createElement('div');
        catTitle.className = 'blocked-category-title';
        catTitle.textContent = catNames[cat] || cat;
        catDiv.appendChild(catTitle);

        const chipContainer = document.createElement('div');
        chipContainer.className = 'blocked-chip-container';

        tags.forEach(tag => {
            const chip = document.createElement('span');
            chip.className = 'blocked-chip';
            chip.innerHTML = `${decodeHTML(tag.display)} <button class="remove-chip" data-type="tag" data-value="${tag.encoded}">✕</button>`;
            chipContainer.appendChild(chip);
        });

        catDiv.appendChild(chipContainer);
        container.appendChild(catDiv);
    });

    container.querySelectorAll('.remove-chip').forEach(btn => {
        btn.addEventListener('click', function () {
            removeFromBlocked('tag', this.dataset.value);
        });
    });
}

async function renderBlockedFics() {
    const container = document.getElementById('blockedFicsList');
    if (!container) return;
    const data = await getFromStoragePromise('blockedFics');
    let list = [];
    if (typeof data === 'string') {
        try { list = JSON.parse(data); } catch (e) { list = []; }
    } else if (Array.isArray(data)) {
        list = data;
    }

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (list.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-message';
        empty.textContent = 'No fics blocked.';
        container.appendChild(empty);
        return;
    }

    list.forEach(fic => {
        const chip = document.createElement('span');
        chip.className = 'blocked-chip';
        chip.innerHTML = `${fic.title} <button class="remove-chip" data-type="fic" data-value="${fic.id}">✕</button>`;
        container.appendChild(chip);
    });

    container.querySelectorAll('.remove-chip').forEach(btn => {
        btn.addEventListener('click', function () {
            removeFromBlocked('fic', this.dataset.value);
        });
    });
}

// ========================
//  EXPORT / IMPORT JSON
// ========================

async function generateCSSFromPrefs() {
    const authors = await getFromStoragePromise('blockedAuthors');
    const tags = await getFromStoragePromise('blockedTags');
    const fics = await getFromStoragePromise('blockedFics');
    const anonymous = await getFromStoragePromise('blockAnonymous');

    let css = '';

    if (anonymous === true) {
        css += `.blurb.work:not([class*="user-"]) { display: none !important; }\n`;
    }

    let parsedAuthors = [];
    if (typeof authors === 'string') {
        try { parsedAuthors = JSON.parse(authors); } catch (e) { }
    } else if (Array.isArray(authors)) {
        parsedAuthors = authors;
    }
    parsedAuthors.forEach(author => {
        css += `.blurb:has(a[href*="/users/${author}/pseuds"]) { display: none !important; }\n`;
    });

    let parsedTags = [];
    if (typeof tags === 'string') {
        try { parsedTags = JSON.parse(tags); } catch (e) { }
    } else if (Array.isArray(tags)) {
        parsedTags = tags;
    }
    parsedTags.forEach(tag => {
        const encoded = tag.encoded || tag;
        css += `.blurb:has(a[href*="${encoded}"]) { display: none !important; }\n`;
    });

    let parsedFics = [];
    if (typeof fics === 'string') {
        try { parsedFics = JSON.parse(fics); } catch (e) { }
    } else if (Array.isArray(fics)) {
        parsedFics = fics;
    }
    parsedFics.forEach(fic => {
        const id = fic.id || fic;
        css += `.blurb.work[id*="work_${id}"] { display: none !important; }\n`;
    });

    return css;
}

async function exportBlockList() {
    const authors = await getFromStoragePromise('blockedAuthors');
    const tags = await getFromStoragePromise('blockedTags');
    const fics = await getFromStoragePromise('blockedFics');
    const anonymous = await getFromStoragePromise('blockAnonymous');

    let parsedAuthors = [];
    let parsedTags = [];
    let parsedFics = [];

    if (typeof authors === 'string') {
        try { parsedAuthors = JSON.parse(authors); } catch (e) { }
    } else if (Array.isArray(authors)) {
        parsedAuthors = authors;
    }

    if (typeof tags === 'string') {
        try { parsedTags = JSON.parse(tags); } catch (e) { }
    } else if (Array.isArray(tags)) {
        parsedTags = tags;
    }

    if (typeof fics === 'string') {
        try { parsedFics = JSON.parse(fics); } catch (e) { }
    } else if (Array.isArray(fics)) {
        parsedFics = fics;
    }

    const data = {
        version: '1.0',
        blockedAuthors: parsedAuthors,
        blockedTags: parsedTags,
        blockedFics: parsedFics,
        blockAnonymous: anonymous === true
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ao3-filter-blocklist.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Block list exported!', 'success');
}

function importBlockList(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.version) {
                showToast('Invalid file format', 'error');
                return;
            }
            if (data.blockedAuthors) saveToStorage('blockedAuthors', JSON.stringify(data.blockedAuthors));
            if (data.blockedTags) saveToStorage('blockedTags', JSON.stringify(data.blockedTags));
            if (data.blockedFics) saveToStorage('blockedFics', JSON.stringify(data.blockedFics));
            if (data.blockAnonymous !== undefined) saveToStorage('blockAnonymous', data.blockAnonymous);

            renderBlockedAuthors();
            renderBlockedTags();
            renderBlockedFics();
            const toggle = document.getElementById('blockAnonymousToggle');
            if (toggle) toggle.checked = data.blockAnonymous || false;
            showToast('Block list imported!', 'success');

            // Generate and inject CSS after import
            generateCSSFromPrefs().then(css => {
                chrome.tabs.query({ url: '*://archiveofourown.org/*' }, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, { action: 'injectCSS', css: css }).catch(() => { });
                    });
                });
            });
        } catch (err) {
            showToast('Error parsing file: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
}

// ========================
//  FUZZY SEARCH
// ========================

function fuzzySearch(query, items) {
    if (!query) return items;
    const lowerQuery = query.toLowerCase();
    return items.filter(item => {
        let score = 0, queryIdx = 0;
        for (let i = 0; i < item.toLowerCase().length && queryIdx < lowerQuery.length; i++) {
            if (item[i].toLowerCase() === lowerQuery[queryIdx]) {
                score++;
                queryIdx++;
            }
        }
        return queryIdx === lowerQuery.length;
    }).sort((a, b) => {
        const aLower = a.toLowerCase(), bLower = b.toLowerCase(), qLower = query.toLowerCase();
        if (aLower.startsWith(qLower) && !bLower.startsWith(qLower)) return -1;
        if (!aLower.startsWith(qLower) && bLower.startsWith(qLower)) return 1;
        return aLower.indexOf(qLower) - bLower.indexOf(qLower);
    });
}

// ========================
//  KEYBOARD SHORTCUTS
// ========================

document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab.id === 'author') generateAuthorCSS();
        else if (activeTab.id === 'tags') fetchFicTags();
        else if (activeTab.id === 'fics') fetchAuthorFics();
    }
});

// ========================
//  EVENT BINDING & INIT
// ========================

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

    // --- Author ---
    document.getElementById('generateAuthorBtn')?.addEventListener('click', generateAuthorCSS);
    document.getElementById('authorAddBtn')?.addEventListener('click', addAuthorToBlockList);
    document.getElementById('blockAnonymousBtn')?.addEventListener('click', blockAnonymousFics);

    // --- Tags ---
    document.getElementById('fetchTagsBtn')?.addEventListener('click', fetchFicTags);
    document.getElementById('tagAddBtn')?.addEventListener('click', addSelectedTagsToBlockList);
    document.getElementById('selectAllTagsBtn')?.addEventListener('click', selectAllTags);
    document.getElementById('clearAllTagsBtn')?.addEventListener('click', clearAllTags);

    // --- Fics ---
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

    // --- Export / Import ---
    document.getElementById('exportBtn')?.addEventListener('click', exportBlockList);
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