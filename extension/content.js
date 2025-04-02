// Listen for messages from the background script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ASK_CHATGPT") {
    let originalActiveElement;
    let text;
    let pageContext = '';

    // If there's an active text input
    if (
      document.activeElement &&
      (document.activeElement.isContentEditable ||
        document.activeElement.nodeName.toUpperCase() === "TEXTAREA" ||
        document.activeElement.nodeName.toUpperCase() === "INPUT")
    ) {
      // Set as original for later
      originalActiveElement = document.activeElement;
      // Use selected text or all text in the input
      text =
        document.getSelection().toString().trim() ||
        document.activeElement.textContent.trim();
    } else {
      // If no active text input use any selected text on page
      text = document.getSelection().toString().trim();
    }

    if (!text) {
      alert(
        "No text found. Select this option after right clicking on a textarea that contains text or on a selected portion of text."
      );
      return;
    }

    // Capture page context
    pageContext = getPageContext();

    // Create a formatted prompt with the selected text and page context
    const formattedPrompt = formatPrompt(text, pageContext);

    showLoadingCursor();

    // Send the text to the API endpoint
    fetch("http://localhost:3000", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        message: formattedPrompt,
        feature: "ask"  // Specify this is the Ask Gemini feature
      }),
    })
      .then((response) => {
        // Get a reader to read the stream
        const reader = response.body.getReader();
        let fullText = '';
        
        // Function to process stream chunks
        function readStream() {
          // Read a chunk
          return reader.read().then(({ done, value }) => {
            // When no more data, return the full text
            if (done) {
              return fullText;
            }
            
            // Decode the chunk and add to full text
            const chunk = new TextDecoder().decode(value);
            fullText += chunk;
            
            // Continue reading
            return readStream();
          });
        }
        
        // Start reading and return promise
        return readStream();
      })
      .then(async (reply) => {
        // If originalActiveElement exists, insert the reply there.
        // Otherwise, always show the dialog for page selections.
        if (originalActiveElement) {
          if (
            originalActiveElement.nodeName.toUpperCase() === "TEXTAREA" ||
            originalActiveElement.nodeName.toUpperCase() === "INPUT"
          ) {
            // Insert after selection in textarea/input
            originalActiveElement.value =
              originalActiveElement.value.slice(0, originalActiveElement.selectionEnd) +
              `\n\n${reply}` +
              originalActiveElement.value.slice(
                originalActiveElement.selectionEnd,
                originalActiveElement.length
              );
          } else if (originalActiveElement.isContentEditable) {
            // Special handling for contenteditable
            const replyNode = document.createTextNode(`\n\n${reply}`);
            const selection = window.getSelection();

            if (selection.rangeCount === 0) {
              selection.addRange(document.createRange());
              selection.getRangeAt(0).collapse(originalActiveElement, 1);
            }

            const range = selection.getRangeAt(0);
            range.collapse(false);

            // Insert reply
            range.insertNode(replyNode);

            // Move the cursor to the end
            selection.collapse(replyNode, replyNode.length);
          }
        } else {
          // No original input element, so show the dedicated dialog
          createResponseDialog(reply);
        }

        restoreCursor();
      })
      .catch((error) => {
        restoreCursor();
        alert(
          "Error. Make sure you're running the server by following the instructions on https://github.com/gragland/chatgpt-chrome-extension. Also make sure you don't have an adblocker preventing requests to localhost:3000."
        );
        throw new Error(error);
      });
  } else if (message.type === "GET_PAGE_CONTEXT") {
    const pageContext = getPageContext();
    sendResponse({ context: pageContext });
    return true; // Important for async response
  } else if (message.type === "OPEN_GEMINI_CHAT") {
    // Open the chat overlay
    openChatOverlay();
  } else if (message.type === "CODE_TESTER") {
    // Handle Code-Tester activation
    activateCodeTester();
  } else if (message.type === "PERFORM_SEARCH") {
    const results = performDirectPageSearch(message.query);
    showSearchResults(results);
    return true;
  } else if (message.type === "GENERATE_IMAGE") {
    handleImageGeneration(message.text);
  }
});

// Function to get the context of the current page
function getPageContext() {
  // Get the title of the page
  const pageTitle = document.title;
  
  // Get the main content of the page (excluding scripts, styles, etc.)
  const bodyText = document.body.innerText.substring(0, 5000); // Limit to 5000 chars to avoid huge payloads
  
  // Get the URL
  const url = window.location.href;
  
  // If it's a GitHub code page, try to get the language and code structure
  const isGitHub = url.includes('github.com');
  let codeInfo = '';
  
  if (isGitHub) {
    // Try to extract programming language and file structure info
    const langElement = document.querySelector('.highlight');
    if (langElement) {
      const lang = langElement.className.split(' ')
        .find(cls => cls.startsWith('highlight-source-'))?.replace('highlight-source-', '');
      codeInfo = `\nThis appears to be a ${lang || 'code'} file on GitHub.`;
    }
  }
  
  // Return a formatted context string
  return `PAGE CONTEXT:
Title: ${pageTitle}
URL: ${url}${codeInfo}
Main content: ${bodyText}
END OF PAGE CONTEXT`;
}

// Function to format the prompt with the user's text and page context
function formatPrompt(selectedText, pageContext) {
  // Enhanced instructions for the AI
  return `\nINSTRUCTIONS:\n1. Explain the following code snippet found on the webpage described in the context.\n2. Focus ONLY on explaining the provided code snippet.\n3. Provide the explanation in a beginner-friendly, step-by-step manner.\n4. Do NOT include any HTML elements or CSS styles in your explanation text itself.\n5. Use markdown for formatting (like \`\`\` for code blocks or * for italics). Do not use HTML tags.\n\nSELECTED CODE SNIPPET:\n---\n${selectedText}\n---\n\n${pageContext}\n\nEXPLANATION:\n`;
}

const showLoadingCursor = () => {
  const style = document.createElement("style");
  style.id = "cursor_wait";
  style.innerHTML = `* {cursor: wait;}`;
  document.head.insertBefore(style, null);
};

const restoreCursor = () => {
  document.getElementById("cursor_wait").remove();
};

// Add at the top of the file
function generateSessionId() {
  return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Function to create and open a chat overlay
function openChatOverlay() {
  // Check if the overlay already exists
  if (document.getElementById('gemini-chat-overlay')) {
    document.getElementById('gemini-chat-overlay').style.display = 'flex';
    return;
  }

  // Generate a unique session ID for this chat
  const sessionId = generateSessionId();

  // Detect if the page is using a dark theme
  const prefersDarkTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const pageHasDarkBg = isDarkMode();
  const useDarkTheme = prefersDarkTheme || pageHasDarkBg;

  // Theme colors
  const theme = {
    header: useDarkTheme ? '#2C5AA0' : '#4285F4',
    headerText: '#FFFFFF',
    background: useDarkTheme ? '#1E1E1E' : 'white',
    messageArea: useDarkTheme ? '#2D2D2D' : '#f5f5f5',
    inputBg: useDarkTheme ? '#3D3D3D' : 'white',
    inputText: useDarkTheme ? '#E0E0E0' : '#333333',
    inputBorder: useDarkTheme ? '#555555' : '#ddd',
    userBubble: useDarkTheme ? '#3A6A35' : '#DCF8C6',
    userText: useDarkTheme ? '#FFFFFF' : '#333333',
    aiBubble: useDarkTheme ? '#404040' : '#ECECEC',
    aiText: useDarkTheme ? '#E0E0E0' : '#333333',
    buttonBg: useDarkTheme ? '#2C5AA0' : '#4285F4',
    buttonText: '#FFFFFF',
    codeBg: useDarkTheme ? '#2B2B2B' : '#f0f0f0',
    codeText: useDarkTheme ? '#E0E0E0' : '#333333',
  };

  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'gemini-chat-overlay';
  overlay.style.cssText = `
    position: fixed;
    right: 20px;
    bottom: 20px;
    width: 350px;
    height: 500px;
    background-color: ${theme.background};
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    font-family: Arial, sans-serif;
    overflow: hidden;
    color: ${theme.inputText};
    transition: all 0.3s ease;
  `;

  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 15px;
    background-color: ${theme.header};
    color: ${theme.headerText};
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  header.textContent = 'Gemini Assistant';

  // Create close button
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.style.cssText = `
    background: none;
    border: none;
    color: ${theme.headerText};
    font-size: 20px;
    cursor: pointer;
  `;
  closeButton.onclick = function() {
    overlay.style.display = 'none';
  };
  header.appendChild(closeButton);

  // Create theme toggle button
  const themeToggle = document.createElement('button');
  themeToggle.innerHTML = useDarkTheme ? '☀️' : '🌙';
  themeToggle.title = useDarkTheme ? 'Switch to light mode' : 'Switch to dark mode';
  themeToggle.style.cssText = `
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    margin-right: 10px;
    color: ${theme.headerText};
  `;
  themeToggle.onclick = function() {
    const overlayElement = document.getElementById('gemini-chat-overlay');
    if (overlayElement) {
      // Toggle theme
      const currentTheme = overlayElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      overlayElement.setAttribute('data-theme', newTheme);
      
      // Recreate the overlay with the new theme
      overlayElement.remove();
      openChatOverlay();
    }
  };
  header.insertBefore(themeToggle, closeButton);

  // Set theme attribute for future reference
  overlay.setAttribute('data-theme', useDarkTheme ? 'dark' : 'light');

  // Create messages container
  const messagesContainer = document.createElement('div');
  messagesContainer.id = 'gemini-chat-messages';
  messagesContainer.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 15px;
    background-color: ${theme.messageArea};
    scrollbar-width: thin;
    scrollbar-color: ${theme.inputBorder} ${theme.messageArea};
  `;

  // Custom scrollbar styling
  if (useDarkTheme) {
    messagesContainer.style.cssText += `
      ::-webkit-scrollbar {
        width: 8px;
      }
      ::-webkit-scrollbar-track {
        background: ${theme.messageArea};
      }
      ::-webkit-scrollbar-thumb {
        background: ${theme.inputBorder};
        border-radius: 4px;
      }
    `;
  }

  // Create input container
  const inputContainer = document.createElement('div');
  inputContainer.style.cssText = `
    display: flex;
    padding: 10px;
    border-top: 1px solid ${theme.inputBorder};
    background-color: ${theme.inputBg};
  `;

  // Create text input
  const textInput = document.createElement('textarea');
  textInput.placeholder = 'Type your message...';
  textInput.rows = 2;
  textInput.style.cssText = `
    flex: 1;
    padding: 10px;
    border: 1px solid ${theme.inputBorder};
    border-radius: 5px;
    resize: none;
    margin-right: 10px;
    background-color: ${theme.inputBg};
    color: ${theme.inputText};
  `;

  // Handle Enter key in the textarea
  textInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendButton.click();
    }
  });

  // Create send button
  const sendButton = document.createElement('button');
  sendButton.textContent = 'Send';
  sendButton.style.cssText = `
    background-color: ${theme.buttonBg};
    color: ${theme.buttonText};
    border: none;
    border-radius: 5px;
    padding: 0 15px;
    cursor: pointer;
    font-weight: bold;
  `;

  // Create a search button
  const searchButton = document.createElement('button');
  searchButton.textContent = '🔍';
  searchButton.title = 'SiteSearch: Search within this website';
  searchButton.style.cssText = `
    background-color: ${theme.buttonBg};
    color: ${theme.buttonText};
    border: none;
    border-radius: 5px;
    padding: 0 10px;
    margin-right: 10px;
    cursor: pointer;
    font-weight: bold;
  `;
  searchButton.onclick = function() {
    const currentText = textInput.value.trim();
    if (!currentText) {
      addMessageToChat("What would you like to search for?", 'ai');
      return;
    }
    
    // Add user search message to chat
    addMessageToChat(`Search for: ${currentText}`, 'user');
    
    // Clear input
    textInput.value = '';
    
    // Add loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'gemini-ai-message';
    loadingDiv.innerHTML = '<div class="gemini-loading"></div>';
    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Get the current site
    const currentSite = window.location.hostname;
    
    // Send the search request directly
    fetch('http://localhost:3000', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        message: currentText,
        feature: "chat",
        forceSearch: true,
        currentSite: currentSite
      })
    })
    .then(response => {
      // Remove loading indicator
      if (messagesContainer.contains(loadingDiv)) {
        messagesContainer.removeChild(loadingDiv);
      }

      if (!response.ok) {
        throw new Error('Server error: ' + response.status);
      }

      // Read the response stream
      const reader = response.body.getReader();
      let fullText = '';
      
      function readStream() {
        return reader.read().then(({ done, value }) => {
          if (done) {
            // Add the full response to chat
            addMessageToChat(fullText, 'ai');
            return;
          }
          
          // Decode and append to full text
          const chunk = new TextDecoder().decode(value);
          fullText += chunk;
          
          // Continue reading
          return readStream();
        });
      }
      
      return readStream();
    })
    .catch(error => {
      // Remove loading indicator
      if (messagesContainer.contains(loadingDiv)) {
        messagesContainer.removeChild(loadingDiv);
      }
      
      // Show error message
      addMessageToChat('Error: ' + error.message, 'ai');
    });
  };

  // Update the send button functionality
  sendButton.onclick = function() {
    const message = textInput.value.trim();
    if (!message) return;

    // Check if this is an image generation request
    if (message.toLowerCase().includes('generate image') || 
        message.toLowerCase().includes('create image') ||
        message.toLowerCase().includes('generate an image') ||
        message.toLowerCase().includes('create an image')) {
      addMessageToChat("I cannot generate images in chat. Please use the right-click menu and select 'Generate Image' on your selected text.", 'ai');
      textInput.value = '';
      return;
    }

    // Add user message to chat
    addMessageToChat(message, 'user');
    
    // Clear input
    textInput.value = '';

    // Get page context
    const pageContext = getPageContext();

    // Format the prompt
    const formattedPrompt = `${message}\n\n${pageContext}`;

    // Add loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'gemini-ai-message';
    loadingDiv.innerHTML = '<div class="gemini-loading"></div>';
    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Send to server with session ID
    fetch('http://localhost:3000', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        message: formattedPrompt,
        feature: "chat",
        sessionId: sessionId  // Include the session ID
      })
    })
    .then(response => {
      // Remove loading indicator
      if (messagesContainer.contains(loadingDiv)) {
        messagesContainer.removeChild(loadingDiv);
      }

      if (!response.ok) {
        throw new Error('Server error: ' + response.status);
      }

      // Read the response stream
      const reader = response.body.getReader();
      let fullText = '';
      
      function readStream() {
        return reader.read().then(({ done, value }) => {
          if (done) {
            // Add the full response to chat
            addMessageToChat(fullText, 'ai');
            return;
          }
          
          // Decode and append to full text
          const chunk = new TextDecoder().decode(value);
          fullText += chunk;
          
          // Continue reading
          return readStream();
        });
      }
      
      return readStream();
    })
    .catch(error => {
      // Remove loading indicator
      if (messagesContainer.contains(loadingDiv)) {
        messagesContainer.removeChild(loadingDiv);
      }
      
      // Show error message
      addMessageToChat('Error: ' + error.message, 'ai');
    });
  };

  // Function to add a message to the chat
  function addMessageToChat(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `gemini-${sender}-message`;
    
    const bubbleColor = sender === 'user' ? theme.userBubble : theme.aiBubble;
    const textColor = sender === 'user' ? theme.userText : theme.aiText;
    
    messageDiv.style.cssText = `
      margin-bottom: 10px;
      padding: 10px;
      border-radius: 18px;
      max-width: 80%;
      ${sender === 'user' ? 'margin-left: auto;' : 'margin-right: auto;'} 
      background-color: ${bubbleColor};
      color: ${textColor};
      word-wrap: break-word;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    `;
    
    // Use our sanitize function to safely format the text
    const sanitizedHTML = sanitizeHTML(text, theme);
    
    // Set the innerHTML with our sanitized content
    messageDiv.innerHTML = sanitizedHTML;
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to the bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Update initial welcome message
  setTimeout(() => {
    addMessageToChat("Hi! I'm your Gemini Assistant. I can help with emails, code explanation, social media content, and more. For image generation, please use the right-click menu and select 'Generate Image' on your selected text.", 'ai');
  }, 100);

  // Add CSS for loading animation
  const style = document.createElement('style');
  style.textContent = `
    .gemini-loading {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid rgba(128,128,128,0.2);
      border-radius: 50%;
      border-top-color: ${theme.header};
      animation: gemini-spin 1s ease-in-out infinite;
    }
    
    @keyframes gemini-spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Assemble the overlay
  inputContainer.appendChild(textInput);
  inputContainer.appendChild(searchButton);
  inputContainer.appendChild(sendButton);
  overlay.appendChild(header);
  overlay.appendChild(messagesContainer);
  overlay.appendChild(inputContainer);
  document.body.appendChild(overlay);

  // Focus the input
  textInput.focus();
}

// Function to detect if a page is using dark mode
function isDarkMode() {
  // Get the background color of the body
  const bodyBg = window.getComputedStyle(document.body).backgroundColor;
  
  // Convert rgb/rgba to brightness value
  let brightness = 255; // Default to light
  
  if (bodyBg) {
    const rgb = bodyBg.match(/\d+/g);
    if (rgb && rgb.length >= 3) {
      // Calculate perceived brightness (weighted for human perception)
      // Using the formula: (0.299*R + 0.587*G + 0.114*B)
      brightness = Math.round(
        (0.299 * parseInt(rgb[0])) + 
        (0.587 * parseInt(rgb[1])) + 
        (0.114 * parseInt(rgb[2]))
      );
    }
  }
  
  // If brightness is less than 128, it's likely a dark theme
  return brightness < 128;
}

// *** PLACEHOLDER FOR FUTURE TOOL IMPLEMENTATIONS ***
// Example tool function:
// async function generateAndDisplayImage(prompt, container) {
//   // Implementation for image generation tool
//   // This would call an API endpoint or use a library to generate an image
//   // and then display it in the provided container
// }

// Function to create a response dialog for right-click "Ask Gemini" responses
function createResponseDialog(text) {
  // Detect if the page is using a dark theme
  const prefersDarkTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const pageHasDarkBg = isDarkMode();
  const useDarkTheme = prefersDarkTheme || pageHasDarkBg;

  // Use the same theme as the chat overlay
  const theme = {
    header: useDarkTheme ? '#2C5AA0' : '#4285F4',
    headerText: '#FFFFFF',
    background: useDarkTheme ? '#1E1E1E' : 'white',
    messageArea: useDarkTheme ? '#2D2D2D' : '#f5f5f5',
    inputBg: useDarkTheme ? '#3D3D3D' : 'white',
    text: useDarkTheme ? '#E0E0E0' : '#333333',
    codeBg: useDarkTheme ? '#2B2B2B' : '#f0f0f0',
    codeText: useDarkTheme ? '#E0E0E0' : '#333333',
  };

  // Create host element for the Shadow DOM
  const host = document.createElement('div');
  host.id = 'gemini-response-dialog-host';
  host.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 10000; /* Ensure backdrop is below dialog */
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.5); /* Backdrop */
  `;

  // Attach Shadow Root
  const shadow = host.attachShadow({ mode: 'open' });

  // Create dialog container within the Shadow DOM
  const dialog = document.createElement('div');
  dialog.id = 'gemini-response-dialog'; // Keep ID for potential direct styling if needed
  // Removed inline styles, will be applied via <style> tag

  // Create header
  const header = document.createElement('div');
  // Removed inline styles
  header.textContent = 'Gemini Response';

  // Create close button
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  // Removed inline styles
  closeButton.onclick = function() {
    host.remove(); // Remove the host element which contains the shadow DOM
  };
  header.appendChild(closeButton);

  // Create content area
  const content = document.createElement('div');
  // Removed inline styles

  // Sanitization function
  function sanitizeDialogHTML(text, theme) {
    // 1. Escape HTML characters first to treat the incoming text as plain text
    const tempDiv = document.createElement('div');
    tempDiv.textContent = text;
    let escapedText = tempDiv.innerHTML;

    // 2. Now apply markdown-like formatting to the escaped text
    return escapedText
      // Code blocks ```...```
      .replace(/```([\s\S]*?)```/g, (match, codeContent) => {
        // Double-check escaping inside code blocks if needed, though textContent usually handles it
        const pre = document.createElement('pre');
        pre.style.cssText = `background-color: ${theme.codeBg}; color: ${theme.codeText}; padding: 10px; border-radius: 5px; overflow-x: auto; font-family: monospace; font-size: 0.9em; white-space: pre; word-wrap: normal;`;
        pre.textContent = codeContent; // Use textContent to prevent rendering HTML inside code block
        return pre.outerHTML;
      })
      // Inline code `...`
      .replace(/`([^`]+)`/g, (match, codeContent) => {
        const code = document.createElement('code');
        code.style.cssText = `background-color: ${theme.codeBg}; color: ${theme.codeText}; padding: 2px 4px; border-radius: 3px; font-family: monospace; font-size: 0.9em;`;
        code.textContent = codeContent;
        return code.outerHTML;
      })
      // Bold **...**
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic *...*
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Line breaks
      .replace(/\n/g, '<br>');
  }

  // Use the function with current theme
  const formattedText = sanitizeDialogHTML(text, theme);
  content.innerHTML = formattedText;

  // Create copy button
  const copyButton = document.createElement('button');
  copyButton.textContent = 'Copy Response';
  // Removed inline styles

  copyButton.onclick = function() {
    navigator.clipboard.writeText(text).then(function() {
      copyButton.textContent = 'Copied!';
      setTimeout(() => {
        copyButton.textContent = 'Copy Response';
      }, 2000);
    });
  };

  // Create style element for Shadow DOM
  const style = document.createElement('style');
  style.textContent = `
    :host { /* Styles for the host element itself (optional) */
      font-family: sans-serif; /* Set a base font family */
    }
    div#gemini-response-dialog { /* Target the dialog inside shadow DOM */
      width: 80%;
      max-width: 600px;
      max-height: 80vh;
      background-color: ${theme.background};
      color: ${theme.text};
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 10001; /* Ensure dialog is above backdrop */
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-size: 16px; /* Default readable font size */
      line-height: 1.5; /* Default readable line height */
    }
    div#gemini-response-dialog > div:first-of-type { /* Header styles */
      padding: 15px;
      background-color: ${theme.header};
      color: ${theme.headerText};
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0; /* Prevent header from shrinking */
    }
    div#gemini-response-dialog > div:first-of-type button { /* Close button styles */
      background: none;
      border: none;
      color: ${theme.headerText};
      font-size: 20px;
      cursor: pointer;
    }
    div#gemini-response-dialog > div:nth-of-type(2) { /* Content area styles */
      flex: 1; /* Allow content to grow */
      overflow-y: auto;
      padding: 20px;
      background-color: ${theme.messageArea};
      word-wrap: break-word;
      white-space: pre-wrap; /* Keep line breaks from response */
      max-height: calc(80vh - 100px); /* Adjust max-height considering header/footer */
      scrollbar-width: thin;
      scrollbar-color: ${theme.header} ${theme.messageArea};
    }
     /* Webkit scrollbar styles */
    div#gemini-response-dialog > div:nth-of-type(2)::-webkit-scrollbar {
      width: 8px;
    }
    div#gemini-response-dialog > div:nth-of-type(2)::-webkit-scrollbar-track {
      background: ${theme.messageArea};
    }
    div#gemini-response-dialog > div:nth-of-type(2)::-webkit-scrollbar-thumb {
      background-color: ${theme.header};
      border-radius: 4px;
      border: 2px solid ${theme.messageArea};
    }
    div#gemini-response-dialog > button { /* Copy button styles */
      background-color: ${theme.header};
      color: white;
      border: none;
      border-radius: 5px;
      padding: 8px 15px;
      margin: 10px 20px 15px auto;
      cursor: pointer;
      display: block;
      flex-shrink: 0; /* Prevent button from shrinking */
    }
    /* Ensure code block styles are applied within shadow DOM */
    pre {
      background-color: ${theme.codeBg};
      color: ${theme.codeText};
      padding: 10px; /* More padding */
      border-radius: 5px;
      overflow-x: auto;
      font-family: monospace;
      font-size: 0.9em; /* Make code slightly smaller */
      white-space: pre; /* Preserve whitespace strictly in code blocks */
      word-wrap: normal; /* Prevent wrapping inside code blocks */
    }
    code {
       background-color: ${theme.codeBg};
       color: ${theme.codeText};
       padding: 2px 4px;
       border-radius: 3px;
       font-family: monospace;
       font-size: 0.9em;
    }
  `;

  // Assemble the Shadow DOM
  shadow.appendChild(style);
  dialog.appendChild(header);
  dialog.appendChild(content);
  dialog.appendChild(copyButton);
  shadow.appendChild(dialog);

  // Close when clicking backdrop (host element)
  host.onclick = function(e) {
    if (e.target === host) {
      host.remove();
    }
  };

  // Add the host element (with shadow DOM) to the page
  document.body.appendChild(host);
}

// Modify this function to accept theme as a parameter
function sanitizeHTML(text, theme) {
  // 1. Escape HTML characters first to treat the incoming text as plain text
  const tempDiv = document.createElement('div');
  tempDiv.textContent = text;
  let escapedText = tempDiv.innerHTML;

  // 2. Now apply markdown-like formatting to the escaped text
  return escapedText
    // Code blocks ```...```
    .replace(/```([\s\S]*?)```/g, (match, codeContent) => {
      const pre = document.createElement('pre');
      pre.style.cssText = `background-color: ${theme.codeBg}; color: ${theme.codeText}; padding: 10px; border-radius: 5px; overflow-x: auto; font-family: monospace; font-size: 0.9em; white-space: pre; word-wrap: normal;`;
      pre.textContent = codeContent; // Use textContent to prevent rendering HTML inside code block
      return pre.outerHTML;
    })
    // Inline code `...`
    .replace(/`([^`]+)`/g, (match, codeContent) => {
      const code = document.createElement('code');
      code.style.cssText = `background-color: ${theme.codeBg}; color: ${theme.codeText}; padding: 2px 4px; border-radius: 3px; font-family: monospace; font-size: 0.9em;`;
      code.textContent = codeContent;
      return code.outerHTML;
    })
    // Bold **...**
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic *...*
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Line breaks
    .replace(/\n/g, '<br>');
}

// Add this new function to content.js
function activateCodeTester() {
  // Get the entire page context
  const pageContext = getPageContext();
  
  // Format the prompt specifically for code testing
  const formattedPrompt = `Please create exam-style questions based on the code content from this page. Focus on testing understanding of concepts, not just recall. Include real-world scenarios where applicable.\n\n${pageContext}`;
  
  showLoadingCursor();
  
  // Send to server
  fetch("http://localhost:3000", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ 
      message: formattedPrompt,
      feature: "code-test"  // Specify this is the Code-Tester feature
    }),
  })
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }
    
    // Get a reader to read the stream
    const reader = response.body.getReader();
    let fullText = '';
    
    // Function to process stream chunks
    function readStream() {
      // Read a chunk
      return reader.read().then(({ done, value }) => {
        // When no more data, return the full text
        if (done) {
          return fullText;
        }
        
        // Decode the chunk and add to full text
        const chunk = new TextDecoder().decode(value);
        fullText += chunk;
        
        // Continue reading
        return readStream();
      });
    }
    
    // Start reading and return promise
    return readStream();
  })
  .then((reply) => {
    // Create a custom dialog for the code test results
    createCodeTesterDialog(reply);
    restoreCursor();
  })
  .catch((error) => {
    restoreCursor();
    console.error("Code tester error details:", error);
    alert(
      `Error generating code test questions: ${error.message}\nCheck browser console for more details.`
    );
  });
}

// Add this new function to create a dialog specifically for code tester results
function createCodeTesterDialog(text) {
  // Detect if the page is using a dark theme (reuse existing function)
  const prefersDarkTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const pageHasDarkBg = isDarkMode();
  const useDarkTheme = prefersDarkTheme || pageHasDarkBg;

  // Use the same theme as the chat overlay
  const theme = {
    header: useDarkTheme ? '#2C5AA0' : '#4285F4',
    headerText: '#FFFFFF',
    background: useDarkTheme ? '#1E1E1E' : 'white',
    messageArea: useDarkTheme ? '#2D2D2D' : '#f5f5f5',
    inputBg: useDarkTheme ? '#3D3D3D' : 'white',
    text: useDarkTheme ? '#E0E0E0' : '#333333',
    codeBg: useDarkTheme ? '#2B2B2B' : '#f0f0f0',
    codeText: useDarkTheme ? '#E0E0E0' : '#333333',
  };

  // Create dialog container
  const dialog = document.createElement('div');
  dialog.id = 'gemini-code-tester-dialog';
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 80%;
    max-width: 800px;
    max-height: 80vh;
    background-color: ${theme.background};
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 10001;
    display: flex;
    flex-direction: column;
    font-family: Arial, sans-serif;
    overflow: hidden;
    color: ${theme.text};
  `;

  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 15px;
    background-color: ${theme.header};
    color: ${theme.headerText};
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  header.textContent = 'Educator Pro Mode - Code Quiz';

  // Create close button
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.style.cssText = `
    background: none;
    border: none;
    color: ${theme.headerText};
    font-size: 20px;
    cursor: pointer;
  `;
  closeButton.onclick = function() {
    dialog.remove();
    // Remove backdrop
    document.getElementById('gemini-dialog-backdrop').remove();
  };
  header.appendChild(closeButton);

  // Create content area
  const content = document.createElement('div');
  content.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    background-color: ${theme.messageArea};
    word-wrap: break-word;
    white-space: pre-wrap;
    max-height: 60vh;
    scrollbar-width: thin;
    scrollbar-color: ${theme.header} ${theme.messageArea};
  `;

  // Define sanitizeDialogHTML function here directly or use sanitizeHTML
  function sanitizeDialogHTML(text, theme) {
    // 1. Escape HTML characters first to treat the incoming text as plain text
    const tempDiv = document.createElement('div');
    tempDiv.textContent = text;
    let escapedText = tempDiv.innerHTML;

    // 2. Now apply markdown-like formatting to the escaped text
    return escapedText
      // Code blocks ```...```
      .replace(/```([\s\S]*?)```/g, (match, codeContent) => {
        // Double-check escaping inside code blocks if needed, though textContent usually handles it
        const pre = document.createElement('pre');
        pre.style.cssText = `background-color: ${theme.codeBg}; color: ${theme.codeText}; padding: 10px; border-radius: 5px; overflow-x: auto; font-family: monospace; font-size: 0.9em; white-space: pre; word-wrap: normal;`;
        pre.textContent = codeContent; // Use textContent to prevent rendering HTML inside code block
        return pre.outerHTML;
      })
      // Inline code `...`
      .replace(/`([^`]+)`/g, (match, codeContent) => {
        const code = document.createElement('code');
        code.style.cssText = `background-color: ${theme.codeBg}; color: ${theme.codeText}; padding: 2px 4px; border-radius: 3px; font-family: monospace; font-size: 0.9em;`;
        code.textContent = codeContent;
        return code.outerHTML;
      })
      // Bold **...**
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic *...*
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Line breaks
      .replace(/\n/g, '<br>');
  }
  
  // Use the function with current theme
  const formattedText = sanitizeDialogHTML(text, theme);
  content.innerHTML = formattedText;

  // Create a semi-transparent backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'gemini-dialog-backdrop';
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 10000;
  `;
  
  // Close when clicking backdrop
  backdrop.onclick = function(e) {
    if (e.target === backdrop) {
      dialog.remove();
      backdrop.remove();
    }
  };

  // Add copy button
  const copyButton = document.createElement('button');
  copyButton.textContent = 'Copy Questions';
  copyButton.style.cssText = `
    background-color: ${theme.header};
    color: white;
    border: none;
    border-radius: 5px;
    padding: 8px 15px;
    margin: 10px 20px 15px auto;
    cursor: pointer;
    display: block;
  `;
  copyButton.onclick = function() {
    navigator.clipboard.writeText(text).then(function() {
      copyButton.textContent = 'Copied!';
      setTimeout(() => {
        copyButton.textContent = 'Copy Questions';
      }, 2000);
    });
  };

  // Assemble the dialog
  dialog.appendChild(header);
  dialog.appendChild(content);
  dialog.appendChild(copyButton);
  
  // Add to the page
  document.body.appendChild(backdrop);
  document.body.appendChild(dialog);
}

// Function to perform a direct page search
function performDirectPageSearch(query) {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return [];
  
  // Get all text content from the page
  const pageContent = document.body.innerText;
  const paragraphs = document.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, div');
  
  // Store matches with their context
  const matches = [];
  
  // Search through all paragraph elements
  paragraphs.forEach(element => {
    const text = element.innerText;
    if (text.toLowerCase().includes(cleanQuery)) {
      // Get some context around the match
      const index = text.toLowerCase().indexOf(cleanQuery);
      const start = Math.max(0, index - 50);
      const end = Math.min(text.length, index + cleanQuery.length + 50);
      let context = text.slice(start, end);
      
      // Add ellipsis if we trimmed the text
      if (start > 0) context = '...' + context;
      if (end < text.length) context += '...';
      
      // Highlight the matched text
      const highlightedContext = context.replace(
        new RegExp(cleanQuery, 'gi'),
        match => `<mark>${match}</mark>`
      );
      
      matches.push({
        element: element,
        context: highlightedContext
      });
    }
  });
  
  return matches;
}

// Function to display search results in a dialog
function showSearchResults(results) {
  // Remove any existing results dialog
  const existingDialog = document.getElementById('page-search-results');
  if (existingDialog) existingDialog.remove();
  
  // Create results dialog
  const dialog = document.createElement('div');
  dialog.id = 'page-search-results';
  dialog.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 400px;
    max-height: 80vh;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 10000;
    overflow-y: auto;
    padding: 16px;
  `;
  
  // Add results to dialog
  if (results.length > 0) {
    results.forEach((result, index) => {
      const resultDiv = document.createElement('div');
      resultDiv.style.marginBottom = '16px';
      resultDiv.style.padding = '8px';
      resultDiv.style.borderBottom = '1px solid #eee';
      resultDiv.innerHTML = `
        <div style="margin-bottom: 8px;">Result ${index + 1}:</div>
        <div>${result.context}</div>
      `;
      
      // Add click handler to scroll to the result
      resultDiv.addEventListener('click', () => {
        result.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        result.element.style.backgroundColor = '#fff3cd';
        setTimeout(() => {
          result.element.style.backgroundColor = '';
        }, 2000);
      });
      
      dialog.appendChild(resultDiv);
    });
  } else {
    dialog.innerHTML = '<div style="padding: 16px;">No results found on this page.</div>';
  }
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    border: none;
    background: none;
    font-size: 20px;
    cursor: pointer;
    padding: 4px 8px;
  `;
  closeButton.onclick = () => dialog.remove();
  dialog.appendChild(closeButton);
  
  document.body.appendChild(dialog);
}

// Function to handle image generation
async function handleImageGeneration(text) {
  showLoadingCursor();

  try {
    const response = await fetch("http://localhost:3000/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        prompt: text,
        feature: "image"
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    
    // Create a temporary link to trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated-image-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    restoreCursor();
  } catch (error) {
    restoreCursor();
    console.error("Image generation error:", error);
    alert("Error generating image. Please try again.");
  }
}

async function generateImage(prompt) {
  try {
    const response = await fetch('http://localhost:3000/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate image');
    }

    // Get the image blob
    const imageBlob = await response.blob();
    
    // Create object URL
    const imageUrl = URL.createObjectURL(imageBlob);
    
    // Create and display image element
    const imageElement = document.createElement('img');
    imageElement.src = imageUrl;
    imageElement.style.maxWidth = '100%';
    imageElement.style.height = 'auto';
    imageElement.style.marginTop = '10px';
    
    // Add to chat container
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
      chatContainer.appendChild(imageElement);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    return imageUrl;
  } catch (error) {
    console.error('Error generating image:', error);
    throw error;
  }
}
