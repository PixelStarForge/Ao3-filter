// ========================
//  STORAGE HELPERS
// ========================

function saveToStorage(key, value) {
    chrome.storage.local.set({ [key]: value });
}

function getFromStorage(key, callback) {
    chrome.storage.local.get([key], (result) => {
        callback(result[key] || '');
    });
}

// ========================
//  DARK MODE TOGGLE
// ========================

function isDarkModeEnabled() {
    // If we have no light class, we're in dark mode
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
    // Store as string so it can be compared correctly
    saveToStorage('darkMode', String(dark));
}

function toggleDarkMode() {
    setDarkMode(!isDarkModeEnabled());
}

// ========================
//  FETCH HELPERS (direct)
// ========================

async function fetchPageHTML(url) {
    const response = await fetch(url, {
        credentials: 'include'
    });
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
        showToast(`CSS generated for @${username}`, 'success');
        // Save to storage
        saveToStorage('lastAuthorUrl', url);
    } catch (error) {
        showMessage(message, `Error: ${error.message}`, 'error');
    } finally {
        spinner.style.display = 'none';
        btn.disabled = false;
    }
}

// ========================
//  TAG BLOCKER
// ========================

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

        const warnings = extractTagsByClass(metadata, 'warning');
        const relationships = extractTagsByClass(metadata, 'relationship');
        const characters = extractTagsByClass(metadata, 'character');
        const freeforms = extractTagsByClass(metadata, 'freeform');

        displayTagCategory('tagsWarningsSection', 'Warnings', warnings);
        displayTagCategory('tagsRelationshipsSection', 'Relationships', relationships);
        displayTagCategory('tagsCharactersSection', 'Characters', characters);
        displayTagCategory('tagsExtraSection', 'Extra Tags', freeforms);

        document.getElementById('tagOutput').style.display = 'block';
        showToast('Tags loaded', 'success');
        // Save to storage
        saveToStorage('lastFicUrl', url);
    } catch (error) {
        showMessage(message, `Error: ${error.message}`, 'error');
    } finally {
        spinner.style.display = 'none';
        btn.disabled = false;
    }
}

function extractTagsByClass(metadata, className) {
    const tags = [];
    const regex = new RegExp(`<dd class="${className}[^"]*"[^>]*>([\\s\\S]*?)<\\/dd>`, "i");
    const match = regex.exec(metadata);
    if (!match) return tags;

    const content = match[1];
    const tagRegex = /<a class="tag" href="\/tags\/([^"]+)\/works">([^<]+)<\/a>/g;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(content)) !== null) {
        tags.push({ encoded: tagMatch[1], display: tagMatch[2] });
    }
    return tags;
}

function displayTagCategory(sectionId, title, tags) {
    const section = document.getElementById(sectionId);

    while (section.firstChild) {
        section.removeChild(section.firstChild);
    }

    if (tags.length === 0) {
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

        const span = document.createElement('span');
        span.textContent = tag.display;

        label.appendChild(checkbox);
        label.appendChild(span);
        listDiv.appendChild(label);
    });

    categoryDiv.appendChild(listDiv);
    section.appendChild(categoryDiv);
    updateTagCSS();
}

function updateTagCSS() {
    const checkboxes = document.querySelectorAll('.tag-checkbox');
    const selected = Array.from(checkboxes).filter(cb => cb.checked);
    let css = '';
    selected.forEach(cb => {
        css += `.blurb:has(a[href*="${cb.value}"]) { display: none !important; }\n\n`;
    });
    document.getElementById('tagsCssCode').textContent = css || '/* Select tags to generate CSS */';

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
        showToast(`Loaded ${workCount} fic(s)`, 'success');
        // Save to storage
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

    container.innerHTML = '';

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
            label.innerHTML = `<input type="checkbox" class="fic-checkbox" value="${fic.id}"> <span>${fic.title}</span>`;
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
        css += `.blurb.work[id*="work-${cb.value}"] { display: none !important; }\n`;
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
//  KEYBOARD SHORTCUTS (Enter)
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
    getFromStorage('darkMode', (value) => {
        // value is a string: '' (not set), 'true', or 'false'
        const dark = value === '' ? true : (value === 'true');
        setDarkMode(dark);
    });
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);

    // --- Restore saved inputs ---
    getFromStorage('lastAuthorUrl', (val) => {
        if (val) document.getElementById('authorUrl').value = val;
    });
    getFromStorage('lastFicUrl', (val) => {
        if (val) document.getElementById('ficUrl').value = val;
    });
    getFromStorage('lastFicAuthorUrl', (val) => {
        if (val) document.getElementById('ficAuthorUrl').value = val;
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
            const inputId = this.dataset.clear;
            clearInput(inputId);
        });
    });

    // --- Author ---
    document.getElementById('generateAuthorBtn')?.addEventListener('click', generateAuthorCSS);

    // --- Tags ---
    document.getElementById('fetchTagsBtn')?.addEventListener('click', fetchFicTags);
    document.getElementById('selectAllTagsBtn')?.addEventListener('click', selectAllTags);
    document.getElementById('clearAllTagsBtn')?.addEventListener('click', clearAllTags);

    // --- Fics ---
    document.getElementById('fetchFicsBtn')?.addEventListener('click', fetchAuthorFics);
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

    // --- Delegated change events for dynamically created checkboxes ---
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
});


// --- Block Anonymous Fics ---
document.getElementById('blockAnonymousBtn')?.addEventListener('click', function () {
    const css = `.blurb.work:not([class*="user-"]) {\n  display: none !important;\n}`;
    document.getElementById('authorCssCode').textContent = css;
    document.getElementById('authorCssOutput').style.display = 'block';
    document.getElementById('authorCopyBtnGroup').style.display = 'flex';
    showToast('CSS generated to hide anonymous fics', 'success');
});