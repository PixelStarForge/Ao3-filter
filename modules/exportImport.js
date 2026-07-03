import { getFromStoragePromise, saveToStorage } from './storage.js';
import { showToast } from './utils.js';
import { renderBlockedAuthors, renderBlockedTags, renderBlockedFics, generateCSSFromPrefs, renderBlockedLanguages } from './blockList.js';

export async function exportBlockList() {
    const authors = await getFromStoragePromise('blockedAuthors');
    const tags = await getFromStoragePromise('blockedTags');
    const fics = await getFromStoragePromise('blockedFics');
    const anonymous = await getFromStoragePromise('blockAnonymous');
    const languages = await getFromStoragePromise('blockedLanguages');

    let parsedAuthors = [], parsedTags = [], parsedFics = [], parsedLanguages = [];

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
    if (typeof languages === 'string') {
        try { parsedLanguages = JSON.parse(languages); } catch (e) { }
    } else if (Array.isArray(languages)) {
        parsedLanguages = languages;
    }

    const data = {
        version: '2.0',
        blockedAuthors: parsedAuthors,
        blockedTags: parsedTags,
        blockedFics: parsedFics,
        blockedLanguages: parsedLanguages,
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

export async function exportCSS() {
    const authors = await getFromStoragePromise('blockedAuthors');
    const tags = await getFromStoragePromise('blockedTags');
    const fics = await getFromStoragePromise('blockedFics');
    const languages = await getFromStoragePromise('blockedLanguages');

    let parsedAuthors = [], parsedTags = [], parsedFics = [], parsedLanguages = [];

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
    if (typeof languages === 'string') {
        try { parsedLanguages = JSON.parse(languages); } catch (e) { }
    } else if (Array.isArray(languages)) {
        parsedLanguages = languages;
    }

    let css = '/* Generated AO3 Filter CSS - Do not edit manually */\n\n';

    if (parsedAuthors.length > 0) {
        css += '/* Blocked Authors */\n';
        parsedAuthors.forEach(author => {
            css += `.blurb:has(a[href*="/users/${author}/pseuds"]) { display: none !important; }\n`;
        });
        css += '\n';
    }
    if (parsedTags.length > 0) {
        css += '/* Blocked Tags */\n';
        parsedTags.forEach(tag => {
            const encoded = tag.encoded || tag;
            css += `.blurb:has(a[href*="${encoded}"]) { display: none !important; }\n`;
        });
        css += '\n';
    }
    if (parsedFics.length > 0) {
        css += '/* Blocked Fics */\n';
        parsedFics.forEach(fic => {
            const id = fic.id || fic;
            css += `.blurb.work[id*="work_${id}"] { display: none !important; }\n`;
        });
        css += '\n';
    }
    if (parsedLanguages.length > 0) {
        css += '/* Blocked Languages */\n';
        parsedLanguages.forEach(lang => {
            css += `li.work.blurb:has(dl.stats dd.language[lang="${lang.code}"]) { display: none !important; }\n`;
        });
        css += '\n';
    }

    const blob = new Blob([css], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ao3-filter-blocklist.css';
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSS exported!', 'success');
}

export function importBlockList(file) {
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
            if (data.blockedLanguages) saveToStorage('blockedLanguages', JSON.stringify(data.blockedLanguages));
            if (data.blockAnonymous !== undefined) saveToStorage('blockAnonymous', data.blockAnonymous);

            renderBlockedAuthors();
            renderBlockedTags();
            renderBlockedFics();
            renderBlockedLanguages();
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