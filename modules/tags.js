import { fetchPageHTML, decodeHTML, showMessage, showToast } from './utils.js';
import { addToBlocked, addBlockedLanguage } from './blockList.js';
import { saveToStorage } from './storage.js';

let currentTags = [];
let currentLanguage = null;

export async function fetchFicTags() {
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

        // Extract language
        const langMatch = metadata.match(/<dd class="language"[^>]*lang="([^"]+)"[^>]*>([^<]+)<\/dd>/);
        if (langMatch) {
            currentLanguage = { code: langMatch[1], display: langMatch[2].trim() };
        } else {
            currentLanguage = null;
        }

        displayTagCategory('tagsWarningsSection', '⚠️ Warnings', warnings);
        displayTagCategory('tagsRelationshipsSection', '💕 Relationships', relationships);
        displayTagCategory('tagsCharactersSection', '👤 Characters', characters);
        displayTagCategory('tagsExtraSection', '🏷️ Additional Tags', freeforms);
        displayLanguageOption(currentLanguage);

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
    while (section.firstChild) section.removeChild(section.firstChild);
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
        checkbox.dataset.tag = decodeHTML(tag.display);
        checkbox.dataset.category = tag.category;
        const span = document.createElement('span');
        span.textContent = decodeHTML(tag.display);
        label.appendChild(checkbox);
        label.appendChild(span);
        listDiv.appendChild(label);
    });
    categoryDiv.appendChild(listDiv);
    section.appendChild(categoryDiv);
}

function displayLanguageOption(language) {
    let section = document.getElementById('tagsLanguagesSection');
    if (!section) {
        // Create it if missing
        const extra = document.getElementById('tagsExtraSection');
        const output = document.getElementById('tagOutput');
        if (extra && extra.parentNode) {
            section = document.createElement('div');
            section.id = 'tagsLanguagesSection';
            extra.parentNode.insertBefore(section, extra.nextSibling);
        } else if (output) {
            section = document.createElement('div');
            section.id = 'tagsLanguagesSection';
            output.appendChild(section);
        } else {
            section = document.createElement('div');
            section.id = 'tagsLanguagesSection';
            document.body.appendChild(section);
        }
    }
    while (section.firstChild) section.removeChild(section.firstChild);
    if (!language) {
        const empty = document.createElement('div');
        empty.className = 'empty-message';
        empty.textContent = 'No language detected';
        section.appendChild(empty);
        return;
    }
    const langDiv = document.createElement('div');
    langDiv.className = 'tag-category';
    const titleDiv = document.createElement('div');
    titleDiv.className = 'tag-category-title';
    titleDiv.textContent = '🌐 Language';
    langDiv.appendChild(titleDiv);
    const listDiv = document.createElement('div');
    listDiv.className = 'tag-list';
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'tag-checkbox language-checkbox';
    checkbox.value = language.code;
    checkbox.dataset.tag = language.display;
    checkbox.dataset.category = 'language';
    const span = document.createElement('span');
    span.textContent = `${language.display} (${language.code})`;
    label.appendChild(checkbox);
    label.appendChild(span);
    listDiv.appendChild(label);
    langDiv.appendChild(listDiv);
    section.appendChild(langDiv);
}

export function updateTagCSS() {
    const checkboxes = document.querySelectorAll('.tag-checkbox:not(.language-checkbox)');
    const langCheckbox = document.querySelector('.language-checkbox');
    const selected = Array.from(checkboxes).filter(cb => cb.checked);
    let css = '';
    selected.forEach(cb => {
        css += `.blurb:has(a[href*="${cb.value}"]) { display: none !important; }\n\n`;
    });
    if (langCheckbox && langCheckbox.checked && currentLanguage) {
        css += `li.work.blurb:has(dl.stats dd.language[lang="${currentLanguage.code}"]) { display: none !important; }\n\n`;
    }
    document.getElementById('tagsCssCode').textContent = css || '/* Select tags to generate CSS */';

    const stats = document.getElementById('tagsStats');
    while (stats.firstChild) stats.removeChild(stats.firstChild);
    const totalSelected = selected.length + (langCheckbox && langCheckbox.checked ? 1 : 0);
    const item1 = document.createElement('div');
    item1.className = 'stat-item';
    const span1 = document.createElement('span');
    span1.className = 'stat-value';
    span1.textContent = totalSelected;
    item1.appendChild(document.createTextNode('Selected: '));
    item1.appendChild(span1);
    item1.appendChild(document.createTextNode(' item(s)'));
    const item2 = document.createElement('div');
    item2.className = 'stat-item';
    const span2 = document.createElement('span');
    span2.className = 'stat-value';
    span2.textContent = totalSelected;
    item2.appendChild(document.createTextNode('CSS rules: '));
    item2.appendChild(span2);
    stats.appendChild(item1);
    stats.appendChild(item2);

    document.getElementById('tagsCopyBtnGroup').style.display = totalSelected > 0 ? 'flex' : 'none';
    document.getElementById('tagAddBtnGroup').style.display = totalSelected > 0 ? 'flex' : 'none';
}

export function addSelectedTagsToBlockList() {
    const checkboxes = document.querySelectorAll('.tag-checkbox:not(.language-checkbox)');
    const langCheckbox = document.querySelector('.language-checkbox');
    const selectedTags = Array.from(checkboxes).filter(cb => cb.checked);
    const blockLanguage = langCheckbox && langCheckbox.checked && currentLanguage;

    if (selectedTags.length === 0 && !blockLanguage) {
        showToast('No tags or language selected', 'error');
        return;
    }

    const tagsToAdd = selectedTags.map(cb => ({
        encoded: cb.value,
        display: cb.dataset.tag,
        category: cb.dataset.category
    }));

    if (tagsToAdd.length > 0) {
        addToBlocked('tag', tagsToAdd);
    }
    if (blockLanguage) {
        addBlockedLanguage(currentLanguage.code, currentLanguage.display);
    }

    const total = tagsToAdd.length + (blockLanguage ? 1 : 0);
    showToast(`Added ${total} item(s) to block list`, 'success');
}

export function selectAllTags() {
    document.querySelectorAll('.tag-checkbox').forEach(cb => cb.checked = true);
    updateTagCSS();
}

export function clearAllTags() {
    document.querySelectorAll('.tag-checkbox').forEach(cb => cb.checked = false);
    updateTagCSS();
}