// chrome.storage helpers – all async/promise‑based
export function saveToStorage(key, value) {
    chrome.storage.local.set({ [key]: value });
}

export function getFromStoragePromise(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key] || null);
        });
    });
}

export function saveToStoragePromise(key, value) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
    });
}