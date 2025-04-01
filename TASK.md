#this TASK COMPLETED#here for ref only~

 TASK LIST: Dockerization Steps

This task list outlines the steps to containerize the Node.js backend application using Docker. No code or path is exact here so make sure the correct implemetation based on my exact code base do not use placeholders or pretend code, every function, import, validation must be correctly connected.

- [x] **1. Create `.dockerignore` file:**
    - Prevent unnecessary files (e.g., `node_modules`, `.git`, `.env`, logs) from being copied into the Docker image.
    - *Purpose:* Speeds up builds, keeps image small and secure.
    - *Source:* Docker Blog - 9 Tips for Containerizing Node.js

- [x] **2. Create `Dockerfile`:**
    - [x] Use an official Node.js base image (e.g., `node:lts-slim`).
    - [x] Set the working directory inside the container (e.g., `/usr/src/app`).
    - [x] Copy `package.json` and `package-lock.json`.
    - [x] Install *only* production dependencies using `npm ci --only=production`.
        - *Purpose:* Ensures clean, reliable install based on lock file.
        - *Source:* dev.to - Docker Best Practices
    - [x] Copy application source code (e.g., `server.js`, `config.js`, `plugins/`).
    - [x] Expose the port the server uses (e.g., `EXPOSE 3000`).
    - [x] Add a `HEALTHCHECK` instruction (e.g., using `curl` against `/`).
        - *Purpose:* Allows Docker to monitor container health.
        - *Source:* Docker Blog - 9 Tips for Containerizing Node.js
    - [x] Specify the command to run the server (e.g., `CMD [ "node", "server.js" ]`).

- [x] **3. Create `docker-compose.yml`:**
    - [x] Define the backend service.
    - [x] Specify building the image from the `Dockerfile` (`build: .`).
    - [x] Map host port to container port (e.g., `ports: - "3000:3000"`).
    - [x] Load environment variables from `.env` file using `env_file`.
    - [x] Set a restart policy (e.g., `restart: unless-stopped`).
    - *Purpose:* Simplifies local development, running, and environment variable management.

- [x] **4. Update `README.md`:**
    - Add a new section explaining how to build and run the backend using Docker and Docker Compose.

- [x] **5. Update `TASK.md` (The Original Task File):**
    - Mark the relevant dockerization task(s) as complete in the original `TASK.md` file (id: `docker_extension_backend_tasks`).

# TASK LIST: Extension "Ask Gemini" UI & Explanation Fixes (Date: 01/04/2025)

This task list outlines steps to address the issues where webpage styles interfere with the "Ask Gemini" explanation panel, AI responses include unintended HTML, and text size is inconsistent.

- [ ] **1. Implement UI Isolation (Shadow DOM):**
    - Modify `content.js` specifically within the `createResponseDialog` function (and potentially `createCodeTesterDialog` if it shares the same issue).
    - Instead of directly appending the dialog to `document.body`, create a host element (e.g., a `div`), attach a Shadow Root to it (`host.attachShadow({mode: 'open'})`), and append the dialog's structure *inside* the Shadow Root.
    - Ensure necessary styles (or a link to a CSS file) are added *inside* the Shadow Root as well.
    - *Goal:* Prevent host page CSS from affecting the dialog and vice-versa.

- [ ] **2. Refine Response Sanitization:**
    - Review the `sanitizeHTML` and `sanitizeDialogHTML` functions in `content.js`.
    - Ensure they correctly escape any raw HTML/CSS within the AI's text response *before* processing markdown-like syntax (like code blocks ` ``` ` or ` * `). The current logic seems to handle this, but double-check the order of operations and robustness.
    - Verify that code blocks (`<pre><code>`) are styled distinctly and their content is treated as plain text, not rendered HTML.
    - *Goal:* Display AI responses cleanly, showing code as formatted text, not rendered elements, while preserving markdown.

- [ ] **3. Apply Default Styling within Shadow DOM:**
    - Inside the Shadow Root (from Task 1), apply specific CSS rules for the dialog (`#gemini-response-dialog` and `#gemini-code-tester-dialog`).
    - Set a clear default `font-size` (e.g., `16px` or `1rem`).
    - Set a comfortable `line-height` (e.g., `1.5`).
    - Define a base `font-family` (e.g., `sans-serif`).
    - Ensure styles for `pre` and `code` elements within the dialog provide clear background, text color, and use a monospace font.
    - *Goal:* Ensure consistent, readable text size and styling regardless of the host page's CSS.

- [ ] **4. Verify Text Selection Logic:**
    - In `content.js`, examine the `chrome.runtime.onMessage` listener for `ASK_CHATGPT`.
    - Confirm that `document.getSelection().toString().trim()` or the logic for extracting text from active elements captures *only plain text* content, stripping any HTML tags or style attributes that might be part of the selection range on the webpage.
    - *Goal:* Ensure only the intended code/text snippet is sent to the backend, free of host page HTML.

- [ ] **5. Review and Refine AI Prompt:**
    - In `content.js`, locate the `formatPrompt` function used for the "Ask Gemini" feature.
    - Modify the prompt to explicitly instruct the AI:
        - "Explain the following code snippet found on the page described in the context."
        - "Focus *only* on explaining the provided code snippet."
        - "Do *not* include any HTML elements or CSS styles in your explanation text itself. Use markdown for formatting (like ` ``` ` for code blocks)."
    - In `server.js`, ensure the prompt sent to the Gemini API for the `ask` feature correctly incorporates this refined instruction along with the selected text and page context.
    - *Goal:* Guide the AI to provide a clean, focused explanation of the selected code without adding extra HTML.

- [ ] **6. Test Thoroughly (Manual):**
    - Test the "Ask Gemini" feature on diverse websites (complex CSS, simple CSS, different fonts).
    - Test with selections of HTML, CSS, and JavaScript.
    - Verify style isolation, response cleanliness, and text readability.
    - *Goal:* Confirm the fixes work across various scenarios.