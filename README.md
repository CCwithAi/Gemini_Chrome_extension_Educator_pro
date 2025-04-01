![Gemini Assistant Chrome Extension Logo](extension/icon.png)

# Gemini Assistant v1.1

Works with Google Chrome and Microsoft Edge.

## Features
- Chat with Gemini about webpage content
- Get code explanations and analysis
- SiteSearch: Search within the context of the current website
- Educator Pro Mode: Generate quiz questions from code-related content
- Theme support (light/dark)
- Markdown formatting and syntax highlighting
- Search the site context without leaving the page your on
- Image generation

- Future updates
- 2.5 EXp
- Docker Desktop Backend Hosting
- Long term Chat History - Memo
- Structured Course Content and Progress tracking.
- Deep Search the web without leaving the page your on (perplexity)
- Hosted DB Agentic backend with new frameworks.
- Backend Hosted Pro (paid Version)

## Installation Instructions

### Prerequisites
- Node.js v16.0.0 or higher
- npm or yarn
- Google Gemini API key (create one at [Google AI Studio](https://aistudio.google.com/))
- Google Custom Search API key and Search Engine ID (for search functionality)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/CCwithAi/Gemini_Chrome_extension_Educator_pro.git
   
   cd gemini-chrome-extension
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or if you use yarn
   yarn install
   ```

3. **Configure environment variables**
   - Copy the `.env.example` file to `.env`
   ```bash
   cp .env.example .env
   ```
   - Edit the `.env` file and add your API keys:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   GOOGLE_SEARCH_API_KEY=your_google_search_api_key
   GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
   ```

4. **Start the server**
   ```bash
   npm start
   # or if you use yarn
   yarn start
   ```
   You should see: `Chrome Gemini API listening on port 3000`

### Alternative: Running the Backend with Docker

If you have Docker Desktop installed, you can run the backend service in a container. This is useful for isolating the environment.

**Prerequisites:**
- Docker Desktop installed and running.

**Steps:**

1.  **Ensure `.env` file is configured:** Make sure you have copied `.env.example` to `.env` and filled in your API keys as described in step 3 above. Docker Compose will automatically use this file.

2.  **Build and Run with Docker Compose:**
    Open a terminal in the project's root directory and run:
    ```bash
    docker-compose up --build -d
    ```
    - `--build`: Builds the image before starting the container (only needed the first time or after code changes).
    - `-d`: Runs the container in detached mode (in the background).

3.  **Check Container Status:**
    You can see if the container is running using:
    ```bash
    docker-compose ps
    ```
    You should see the `gemini_backend_service` running and the port mapping `0.0.0.0:3000->3000/tcp`.

4.  **View Logs:**
    To see the server logs from the container:
    ```bash
    docker-compose logs -f
    ```
    Press `Ctrl+C` to stop following the logs.

5.  **Stopping the Container:**
    ```bash
    docker-compose down
    ```

With the backend running in Docker, proceed to step 5 (Load the extension in Chrome). The extension will connect to `http://localhost:3000` which is mapped to the container.

5. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" using the toggle in the top-right corner
   - Click "Load unpacked" and select the `extension` folder from this repository
   - The Gemini Assistant extension should now appear in your extensions list

6. **Using the extension**
   - Click on the Gemini Assistant icon in your extensions toolbar to open the popup
   - Right-click on any webpage and select "Chat with Gemini" to open the chat overlay
   - Select text and right-click to "Ask Gemini" about the selection
   - Right-click on any page and select "Educator Pro Mode" to generate code quizzes

## Plugins
The extension uses a plugin API system for customized functionality:

- Default - Code explanation, analysis, and best practices
- GeneralAssistant - General help with emails, writing, research, and more
- Search - Web search integration using Google Custom Search
- CodeTeacher - Generate educational quizzes and assessments for code learning
- Image - (coming soon) Image generation capabilities

## Security Measures
- Local API server to protect credentials from client-side exposure
- Environment variables for sensitive API keys
- Input validation for search queries
- Error handling for failed API requests
- HTML content sanitization to prevent XSS attacks
- Content Security Policy implementation

## Potential Security Considerations
- API Key Management
  - ✅ Keys are stored server-side, not in the extension
  - ⚠️ Consider using a more secure method than .env files for production

- Content Security
  - ✅ HTML content is properly sanitized
  - ✅ Content Security Policy headers implemented

- Data Privacy
  - ⚠️ Page content is sent to external APIs
  - ✅ Add a privacy policy explaining data handling

- Cross-Origin Requests
  - ✅ CORS is properly configured for local development
  - ⚠️ For production, ensure proper CORS policies are in place

- Extension Permissions
  - ✅ Uses only necessary permissions

## Best Practices for Production
- Add rate limiting to prevent API abuse
- Implement proper error logging that doesn't expose sensitive information
- Regularly update dependencies to patch security vulnerabilities
- Add automated security scanning to your development pipeline

## Troubleshooting
- If you see "Not connected" in the popup, ensure the server is running
- Check the browser console for any error messages
- Verify your API keys are correctly set in the .env file
- Make sure port 3000 is not being used by another application

**Privacy Statement for gemini chrome plug in**

Effective Date: 26.03.25

This statement describes how CCwithAI ("we", "us", "our") handles data when you use our software application.

**Data Sent to Third Parties:**
To provide its core functionality, CCwithAI sends data you input or generate within the application via an Application Programming Interface (API) to Google AI models (operated by Google LLC or its affiliates).

**Use of Data by Google:**
According according to Google's terms and policies governing the use of their AI APIs, data sent to these APIs *may* be used by Google for service improvement, which *can include* the training of their AI models. We do not control how Google uses this data beyond the configurations available through their API services. We strongly recommend you review Google's relevant API terms of service and privacy policies for detailed information.

MIT © [CCwithAI]
