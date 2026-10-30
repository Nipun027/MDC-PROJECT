```javascript
/* =====================================================
   DOCUFIND AI
   Browser-based document indexing and search
   ===================================================== */

"use strict";

// -----------------------------------------------------
// 1. CONFIGURATION
// -----------------------------------------------------

const DB_NAME = "DocuFindAI_Database";
const DB_VERSION = 1;
const STORE_NAME = "documents";

let database = null;
let isProcessing = false;

// -----------------------------------------------------
// 2. DOM ELEMENTS
// -----------------------------------------------------

const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");

const contentSearch = document.getElementById("contentSearch");
const fuzzySearch = document.getElementById("fuzzySearch");

const fileInput = document.getElementById("fileInput");
const folderInput = document.getElementById("folderInput");

const uploadStatus = document.getElementById("uploadStatus");
const searchMessage = document.getElementById("searchMessage");

const documentCount = document.getElementById("documentCount");
const resultCount = document.getElementById("resultCount");

const libraryList = document.getElementById("libraryList");
const resultsList = document.getElementById("resultsList");

const clearLibraryButton =
    document.getElementById("clearLibraryButton");

// -----------------------------------------------------
// 3. INITIALIZE THE APPLICATION
// -----------------------------------------------------

document.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
    try {
        database = await openDatabase();

        if (window.pdfjsLib) {
            pdfjsLib.GlobalWorkerOptions.workerSrc =
                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        }

        await refreshLibrary();

        setStatus(
            uploadStatus,
            "Ready. Select documents to build your library."
        );

        console.log("DocuFind AI initialized successfully.");
    } catch (error) {
        console.error("Initialization error:", error);

        setStatus(
            uploadStatus,
            "Could not initialize browser storage. Try another browser or check storage permissions."
        );
    }
}

// -----------------------------------------------------
// 4. OPEN INDEXEDDB DATABASE
// -----------------------------------------------------

function openDatabase() {
    return new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
            reject(new Error("IndexedDB is not supported."));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function (event) {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: "id"
                });

                store.createIndex("name", "name", {
                    unique: false
                });

                store.createIndex("hash", "hash", {
                    unique: true
                });
            }
        };

        request.onsuccess = function () {
            resolve(request.result);
        };

        request.onerror = function () {
            reject(request.error);
        };

        request.onblocked = function () {
            reject(
                new Error(
                    "Database upgrade blocked. Close other DocuFind AI tabs and reload."
                )
            );
        };
    });
}

// -----------------------------------------------------
// 5. DATABASE HELPERS
// -----------------------------------------------------

function getAllDocuments() {
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(
            STORE_NAME,
            "readonly"
        );

        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function saveDocument(documentData) {
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(
            STORE_NAME,
            "readwrite"
        );

        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(documentData);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function deleteAllDocuments() {
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(
            STORE_NAME,
            "readwrite"
        );

        const request = transaction
            .objectStore(STORE_NAME)
            .clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// -----------------------------------------------------
// 6. EVENT LISTENERS
// -----------------------------------------------------

searchForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    await performSearch();
});

fileInput.addEventListener("change", async function () {
    await handleFiles(fileInput.files);
    fileInput.value = "";
});

folderInput.addEventListener("change", async function () {
    await handleFiles(folderInput.files);
    folderInput.value = "";
});

clearLibraryButton.addEventListener("click", async function () {
    if (isProcessing) {
        setStatus(
            uploadStatus,
            "Please wait until document processing finishes."
        );
        return;
    }

    const confirmed = window.confirm(
        "Are you sure you want to delete all indexed documents from this browser?"
    );

    if (!confirmed) {
        return;
    }

    try {
        await deleteAllDocuments();

        await refreshLibrary();

        resultsList.replaceChildren();

        showEmptyState(
            resultsList,
            "Your search results will appear here."
        );

        resultCount.textContent = "0";

        setStatus(uploadStatus, "Your document library has been cleared.");

        setStatus(
            searchMessage,
            "Enter a search term to get started."
        );
    } catch (error) {
        console.error(error);

        setStatus(
            uploadStatus,
            "Could not clear the library."
        );
    }
});

// -----------------------------------------------------
// 7. STATUS HELPERS
// -----------------------------------------------------

function setStatus(element, message) {
    element.textContent = message;
}

function showEmptyState(container, message) {
    const wrapper = document.createElement("div");
    wrapper.className = "empty-state";

    const paragraph = document.createElement("p");
    paragraph.textContent = message;

    wrapper.appendChild(paragraph);

    container.replaceChildren(wrapper);
}

// -----------------------------------------------------
// 8. PROCESS SELECTED FILES
// -----------------------------------------------------

async function handleFiles(fileCollection) {
    if (isProcessing) {
        setStatus(
            uploadStatus,
            "Please wait for the current indexing task to finish."
        );
        return;
    }

    const files = Array.from(fileCollection || []);

    if (files.length === 0) {
        return;
    }

    isProcessing = true;

    fileInput.disabled = true;
    folderInput.disabled = true;

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            setStatus(
                uploadStatus,
                `Processing ${i + 1} of ${files.length}: ${file.name}`
            );

            try {
                const outcome = await processFile(file);

                if (outcome === "saved") {
                    processed++;
                } else if (outcome === "skipped") {
                    skipped++;
                }
            } catch (error) {
                failed++;

                console.error(
                    "Could not process file:",
                    file.name,
                    error
                );
            }
        }

        await refreshLibrary();

        setStatus(
            uploadStatus,
            `Indexing complete. Added: ${processed}. Duplicates or unsupported files: ${skipped}. Failed: ${failed}.`
        );
    } finally {
        isProcessing = false;

        fileInput.disabled = false;
        folderInput.disabled = false;
    }
}

// -----------------------------------------------------
// 9. CHECK SUPPORTED FILE TYPES
// -----------------------------------------------------

function getExtension(filename) {
    const index = filename.lastIndexOf(".");

    if (index === -1) {
        return "";
    }

    return filename.slice(index + 1).toLowerCase();
}

function isSupportedFile(filename) {
    const supported = [
        "pdf",
        "docx",
        "txt",
        "md",
        "csv",
        "json",
        "html",
        "htm",
        "log"
    ];

    return supported.includes(getExtension(filename));
}

// -----------------------------------------------------
// 10. CREATE A SHA-256 FILE HASH
// -----------------------------------------------------

async function calculateFileHash(file) {
    if (!window.crypto || !window.crypto.subtle) {
        throw new Error(
            "Secure hashing is unavailable. Use HTTPS or localhost."
        );
    }

    const buffer = await file.arrayBuffer();

    const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        buffer
    );

    return Array.from(new Uint8Array(hashBuffer))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

// -----------------------------------------------------
// 11. EXTRACT TEXT FROM A FILE
// -----------------------------------------------------

async function extractText(file) {
    const extension = getExtension(file.name);

    switch (extension) {
        case "pdf":
            return await extractPDFText(file);

        case "docx":
            return await extractDOCXText(file);

        case "txt":
        case "md":
        case "csv":
        case "json":
        case "html":
        case "htm":
        case "log":
            return await file.text();

        default:
            throw new Error("Unsupported file format.");
    }
}

// -----------------------------------------------------
// 12. EXTRACT TEXT FROM PDF
// -----------------------------------------------------

async function extractPDFText(file) {
    if (!window.pdfjsLib) {
        throw new Error("PDF.js could not be loaded.");
    }

    const buffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer)
    }).promise;

    const pageTexts = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);

        const textContent = await page.getTextContent();

        const pageText = textContent.items
            .filter(item => typeof item.str === "string")
            .map(item => item.str)
            .join(" ");

        pageTexts.push(pageText);
    }

    return pageTexts.join("\n\n");
}

// -----------------------------------------------------
// 13. EXTRACT TEXT FROM DOCX
// -----------------------------------------------------

async function extractDOCXText(file) {
    if (!window.mammoth) {
        throw new Error("The DOCX extraction library is unavailable.");
    }

    const buffer = await file.arrayBuffer();

    const result = await mammoth.extractRawText({
        arrayBuffer: buffer
    });

    return result.value || "";
}

// -----------------------------------------------------
// 14. INDEX AND SAVE A DOCUMENT
// -----------------------------------------------------

async function processFile(file) {
    if (!isSupportedFile(file.name)) {
        return "skipped";
    }

    if (file.size === 0) {
        throw new Error("The selected file is empty.");
    }

    const hash = await calculateFileHash(file);

    const existingDocuments = await getAllDocuments();

    const duplicate = existingDocuments.some(
        document => document.hash === hash
    );

    if (duplicate) {
        return "skipped";
    }

    const text = await extractText(file);

    const relativePath =
        file.webkitRelativePath || file.name;

    const documentData = {
        id: hash,
        hash: hash,
        name: file.name,
        path: relativePath,
        extension: getExtension(file.name),
        size: file.size,
        text: text,
        indexedAt: new Date().toISOString()
    };

    await saveDocument(documentData);

    return "saved";
}

// -----------------------------------------------------
// 15. REFRESH DOCUMENT LIBRARY
// -----------------------------------------------------

async function refreshLibrary() {
    if (!database) {
        return;
    }

    const documents = await getAllDocuments();

    documents.sort((a, b) =>
        a.name.localeCompare(b.name)
    );

    documentCount.textContent = String(documents.length);

    libraryList.replaceChildren();

    if (documents.length === 0) {
        showEmptyState(
            libraryList,
            "Your library is empty. Select documents above to get started."
        );

        return;
    }

    for (const documentData of documents) {
        const card = document.createElement("article");
        card.className = "document-card";

        const heading = document.createElement("h4");
        heading.textContent = documentData.name;

        const path = document.createElement("p");
        path.className = "document-path";
        path.textContent = "Path: " + documentData.path;

        const details = document.createElement("p");
        details.textContent =
            `${formatFileSize(documentData.size)} · ` +
            `${documentData.extension.toUpperCase()}`;

        card.append(heading, path, details);

        libraryList.appendChild(card);
    }
}

// -----------------------------------------------------
// 16. SEARCH DOCUMENTS
// -----------------------------------------------------

async function performSearch() {
    const query = searchInput.value.trim();

    if (!query) {
        setStatus(
            searchMessage,
            "Please enter a search term."
        );

        resultsList.replaceChildren();

        resultCount.textContent = "0";

        showEmptyState(
            resultsList,
            "Enter a word or phrase to search your documents."
        );

        return;
    }

    try {
        const documents = await getAllDocuments();

        const terms = query
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);

        const searchInsideContent = contentSearch.checked;
        const allowApproximate = fuzzySearch.checked;

        const matches = [];

        for (const documentData of documents) {
            const filename = documentData.name.toLowerCase();
            const content = (documentData.text || "").toLowerCase();

            let score = 0;

            for (const term of terms) {
                if (filename.includes(term)) {
                    score += 10;
                }

                if (
                    searchInsideContent &&
                    content.includes(term)
                ) {
                    score += 3;
                }

                if (
                    allowApproximate &&
                    term.length >= 4 &&
                    (
                        filename.includes(term.slice(0, -1)) ||
                        (
                            searchInsideContent &&
                            content.includes(term.slice(0, -1))
                        )
                    )
                ) {
                    score += 1;
                }
            }

            if (score > 0) {
                matches.push({
                    document: documentData,
                    score: score
                });
            }
        }

        matches.sort((a, b) => b.score - a.score);

        displaySearchResults(matches, query);

    } catch (error) {
        console.error("Search failed:", error);

        setStatus(
            searchMessage,
            "Search failed. Please reload the page and try again."
        );
    }
}

// -----------------------------------------------------
// 17. DISPLAY SEARCH RESULTS
// -----------------------------------------------------

function displaySearchResults(matches, query) {
    resultsList.replaceChildren();

    resultCount.textContent = String(matches.length);

    if (matches.length === 0) {
        setStatus(
            searchMessage,
            `No documents matched "${query}".`
        );

        showEmptyState(
            resultsList,
            "No matching documents found. Try another search term."
        );

        return;
    }

    setStatus(
        searchMessage,
        `Found ${matches.length} matching document(s).`
    );

    for (const match of matches) {
        const documentData = match.document;

        const card = document.createElement("article");
        card.className = "result-card";

        const heading = document.createElement("h4");
        heading.textContent = documentData.name;

        const path = document.createElement("p");
        path.className = "document-path";
        path.textContent = "Source: " + documentData.path;

        const snippet = document.createElement("p");

        if (contentSearch.checked && documentData.text) {
            snippet.textContent = createSnippet(
                documentData.text,
                query
            );
        } else {
            snippet.textContent =
                "Matched document filename.";
        }

        const details = document.createElement("p");
        details.textContent =
            `Relevance score: ${match.score}`;

        card.append(heading, path, snippet, details);

        resultsList.appendChild(card);
    }
}

// -----------------------------------------------------
// 18. CREATE A RELEVANT TEXT SNIPPET
// -----------------------------------------------------

function createSnippet(text, query) {
    const normalizedText = text.replace(/\s+/g, " ").trim();

    if (!normalizedText) {
        return "No readable text was extracted from this document.";
    }

    const lowerText = normalizedText.toLowerCase();

    const terms = query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

    let firstPosition = -1;

    for (const term of terms) {
        const position = lowerText.indexOf(term);

        if (
            position !== -1 &&
            (
                firstPosition === -1 ||
                position < firstPosition
            )
        ) {
            firstPosition = position;
        }
    }

    if (firstPosition === -1) {
        return normalizedText.slice(0, 250) +
            (normalizedText.length > 250 ? "..." : "");
    }

    const start = Math.max(0, firstPosition - 90);
    const end = Math.min(
        normalizedText.length,
        firstPosition + 180
    );

   
