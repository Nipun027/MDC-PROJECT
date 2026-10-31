/* =====================================================
   DOCUFIND AI
   Semantic document search and browser-based indexing
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
// 3. INITIALIZE APPLICATION
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
            "Could not initialize browser storage."
        );
    }
}

// -----------------------------------------------------
// 4. INDEXEDDB
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

        request.onsuccess = () => resolve(request.result);

        request.onerror = () => reject(request.error);

        request.onblocked = () => {
            reject(new Error("Database upgrade blocked."));
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

        const request = transaction
            .objectStore(STORE_NAME)
            .getAll();

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

        const request = transaction
            .objectStore(STORE_NAME)
            .put(documentData);

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
        setStatus(uploadStatus, "Please wait until processing finishes.");
        return;
    }

    const confirmed = window.confirm(
        "Are you sure you want to delete all indexed documents?"
    );

    if (!confirmed) return;

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

        setStatus(searchMessage, "Enter a search term to get started.");

    } catch (error) {
        console.error(error);

        setStatus(uploadStatus, "Could not clear the library.");
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
// 8. PROCESS FILES
// -----------------------------------------------------

async function handleFiles(fileCollection) {

    if (isProcessing) {
        setStatus(uploadStatus, "Please wait for current indexing to finish.");
        return;
    }

    const files = Array.from(fileCollection || []);

    if (files.length === 0) return;

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

                if (outcome === "saved") processed++;
                else if (outcome === "skipped") skipped++;

            } catch (error) {

                failed++;

                console.error(
                    "Could not process:",
                    file.name,
                    error
                );
            }
        }

        await refreshLibrary();

        setStatus(
            uploadStatus,
            `Indexing complete. Added: ${processed}. Skipped: ${skipped}. Failed: ${failed}.`
        );

    } finally {

        isProcessing = false;

        fileInput.disabled = false;
        folderInput.disabled = false;
    }
}

// -----------------------------------------------------
// 9. FILE TYPES
// -----------------------------------------------------

function getExtension(filename) {

    const index = filename.lastIndexOf(".");

    if (index === -1) return "";

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
// 10. SHA-256 DUPLICATE DETECTION
// -----------------------------------------------------

async function calculateFileHash(file) {

    if (!window.crypto || !window.crypto.subtle) {
        throw new Error("Secure hashing is unavailable.");
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
// 11. TEXT EXTRACTION
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
// 12. PDF EXTRACTION
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

    for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
    ) {

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
// 13. DOCX EXTRACTION
// -----------------------------------------------------

async function extractDOCXText(file) {

    if (!window.mammoth) {
        throw new Error("DOCX extraction library unavailable.");
    }

    const buffer = await file.arrayBuffer();

    const result = await mammoth.extractRawText({
        arrayBuffer: buffer
    });

    return result.value || "";
}

// -----------------------------------------------------
// 14. INDEX DOCUMENT
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

    if (duplicate) return "skipped";

    const text = await extractText(file);

    const documentData = {

        id: hash,
        hash: hash,

        name: file.name,

        path: file.webkitRelativePath || file.name,

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

    if (!database) return;

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

        setStatus(searchMessage, "Please enter a search query.");

        resultsList.replaceChildren();

        resultCount.textContent = "0";

        showEmptyState(
            resultsList,
            "Enter a word or phrase to search your documents."
        );

        return;
    }

    searchButton.disabled = true;

    try {

        const documents = await getAllDocuments();

        if (documents.length === 0) {

            showEmptyState(
                resultsList,
                "Upload documents before searching."
            );

            resultCount.textContent = "0";

            setStatus(searchMessage, "Your document library is empty.");

            return;
        }

        let matches = [];

        if (contentSearch.checked) {

            // SEMANTIC SEARCH USING SENTENCE TRANSFORMERS

            if (typeof window.semanticSearchDocuments === "function") {

                setStatus(
                    searchMessage,
                    "Loading AI model and searching by meaning. First search may take longer..."
                );

                const semanticResults =
                    await window.semanticSearchDocuments(
                        query,
                        documents
                    );

                matches = semanticResults.map(item => ({
                    document: item.document,
                    score: item.score,
                    semantic: true
                }));

            } else {

                throw new Error(
                    "Semantic search module is not loaded."
                );
            }

        } else {

            // FILENAME SEARCH

            const lowerQuery = query.toLowerCase();

            matches = documents
                .filter(doc =>
                    doc.name.toLowerCase().includes(lowerQuery)
                )
                .map(doc => ({
                    document: doc,
                    score: 100,
                    semantic: false
                }));
        }

        displaySearchResults(matches, query);

    } catch (error) {

        console.error("Search failed:", error);

        setStatus(
            searchMessage,
            "AI search failed. Check your internet connection and reload the page."
        );

    } finally {

        searchButton.disabled = false;
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
            "No matching documents found."
        );

        showEmptyState(
            resultsList,
            "Try another search query."
        );

        return;
    }

    setStatus(
        searchMessage,
        `Found ${matches.length} document(s), ranked by semantic similarity.`
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

        snippet.textContent = createSnippet(
            documentData.text || "",
            query
        );

        const similarity = document.createElement("p");

        similarity.className = "similarity-score";

        if (match.semantic) {

            similarity.textContent =
                `Semantic Similarity: ${match.score}%`;

        } else {

            similarity.textContent =
                "Filename Match";
        }

        card.append(
            heading,
            path,
            snippet,
            similarity
        );

        resultsList.appendChild(card);
    }
}

// -----------------------------------------------------
// 18. CREATE TEXT SNIPPET
// -----------------------------------------------------

function createSnippet(text, query) {

    const normalizedText = text
        .replace(/\s+/g, " ")
        .trim();

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

    return (
        (start > 0 ? "..." : "") +
        normalizedText.slice(start, end) +
        (end < normalizedText.length ? "..." : "")
    );
}

// -----------------------------------------------------
// 19. FORMAT FILE SIZE
// -----------------------------------------------------

function formatFileSize(bytes) {

    if (!bytes) return "0 Bytes";

    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];

    const index = Math.floor(
        Math.log(bytes) / Math.log(1024)
    );

    return (
        (bytes / Math.pow(1024, index)).toFixed(2) +
        " " +
        units[index]
    );
}
