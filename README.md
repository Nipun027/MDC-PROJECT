
# DocuFind AI — Personal Document Search

DocuFind AI is a browser-based document search application designed to help users organize and search their personal document collections.

The application provides a simple interface for selecting files, indexing document text, and finding relevant information through keyword-based search.

## Features

- Search documents by filename.
- Search extracted document content.
- Select multiple files.
- Select a folder for indexing.
- Extract text from supported PDF documents.
- Extract text from DOCX documents.
- Read supported text-based files.
- Store the indexed document library in browser IndexedDB.
- Detect duplicate files using SHA-256 hashes.
- Display document names and source paths.
- Display matching text snippets.
- Provide a simple approximate-match option.
- Responsive interface for desktop and mobile browsers.

## Supported File Types

The current frontend supports:

- PDF
- DOCX
- TXT
- Markdown
- CSV
- JSON
- HTML
- LOG

Text extraction depends on the file format and the libraries loading successfully.

Scanned PDFs and image-only documents require OCR integration before their text can be searched.

## Technologies Used

- HTML5
- CSS3
- JavaScript
- IndexedDB
- PDF.js
- Mammoth.js
- Tesseract.js library reference for planned OCR functionality

## Project Structure

```text
DocuFind-AI/
├── index.html
├── style.css
├── app.js
├── README.md
├── render.yaml
└── backend/
    ├── app.py
    └── requirements.txt
```

## Running the Frontend Locally

1. Download or clone this repository.
2. Open the project folder in Visual Studio Code.
3. Open `index.html` using a local development server.
4. Select documents and test the search functionality.

A local development server is recommended because browser storage, secure hashing, and external libraries may behave differently when opening files directly.

## Deployment

The frontend can be deployed as a Render Static Site.

Recommended frontend settings:

- Build command: leave empty.
- Publish directory: `.`

The root directory should contain `index.html`, `style.css`, and `app.js`.

The Python backend, if deployed separately, requires its own Web Service configuration and compatible application dependencies.

## Current Architecture

The current frontend performs document indexing and keyword-based searching in the browser.

Indexed document text and metadata are stored in the browser's IndexedDB database. This storage is specific to the browser profile and website origin.

The frontend is not automatically connected to the Python backend. Backend integration must be configured separately if server-side processing or shared storage is required.

## Privacy

The current frontend processes selected documents locally in the browser and does not automatically upload their contents to a Python backend.

External JavaScript libraries are loaded from third-party CDNs. Loading these libraries requires an internet connection and contacts the corresponding providers.

Do not use confidential documents until the deployment, storage, and privacy requirements have been reviewed.

## Limitations

- Search is keyword-based rather than semantic AI search.
- Approximate matching uses a simple partial-word technique.
- Browser storage is not shared between different devices or browser profiles.
- OCR for scanned documents is not implemented in the current JavaScript application.
- The Python backend is not yet connected to the frontend.
- Large documents may take time to process and use browser storage.

## Future Improvements

- Connect the frontend to the Python backend.
- Add OCR for scanned documents.
- Implement semantic search using embeddings.
- Add authentication and separate user libraries.
- Improve search ranking and document recommendations.
- Add secure server-side storage where required.
- Improve handling of large document collections.

## Project Goal

The goal of DocuFind AI is to make personal document collections easier to search, navigate, and organize through a simple interface.

---

**Project:** DocuFind AI  
**Category:** Personal Document Search  
**Frontend:** HTML, CSS, JavaScript  
**Storage:** Browser IndexedDB



