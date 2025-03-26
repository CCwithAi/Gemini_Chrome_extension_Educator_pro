// DOM elements
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');

// Event listeners
sendButton.addEventListener('click', function(e) {
  e.preventDefault(); // Prevent any default behavior
  e.stopPropagation(); // Stop event from propagating
  sendMessage();
});

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  userInput.focus();
  
  // Add event listener to prevent popup closing on clicks within the popup
  document.body.addEventListener('click', function(e) {
    e.stopPropagation();
  });
});

// Function to send message
async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;
  
  // Add user message to chat
  addMessage(message, 'user');
  
  // Clear input
  userInput.value = '';
  
  // Add loading indicator
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message ai-message';
  loadingDiv.innerHTML = '<div class="loading"></div>';
  messagesContainer.appendChild(loadingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  try {
    // Capture active tab info for context
    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
      let pageContext = '';
      
      if (tabs[0]) {
        // Get the page title and URL
        const pageTitle = tabs[0].title || 'Unknown';
        const url = tabs[0].url || 'Unknown';
        
        // Try to get page content via content script
        try {
          const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
          const result = await chrome.tabs.sendMessage(tab.id, {type: "GET_PAGE_CONTEXT"});
          if (result && result.context) {
            pageContext = result.context;
          } else {
            pageContext = `PAGE CONTEXT:\nTitle: ${pageTitle}\nURL: ${url}\nEND OF PAGE CONTEXT`;
          }
        } catch (e) {
          console.error("Error getting page context:", e);
          // If we can't execute the content script, just use the basic info
          pageContext = `PAGE CONTEXT:\nTitle: ${pageTitle}\nURL: ${url}\nEND OF PAGE CONTEXT`;
        }
      }
      
      // Format the prompt with context
      const formattedPrompt = `${message}\n\n${pageContext}`;
      
      try {
        // Send to server
        const response = await fetch('http://localhost:3000', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message: formattedPrompt })
        });
        
        // Remove loading indicator
        if (messagesContainer.contains(loadingDiv)) {
          messagesContainer.removeChild(loadingDiv);
        }
        
        if (response.ok) {
          // Read the stream
          const reader = response.body.getReader();
          let fullText = '';
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // Decode and append to full text
            fullText += new TextDecoder().decode(value);
          }
          
          // Add AI response to chat
          addMessage(fullText, 'ai');
        } else {
          throw new Error('Server error: ' + response.status);
        }
      } catch (fetchError) {
        console.error("Fetch error:", fetchError);
        // Remove loading indicator
        if (messagesContainer.contains(loadingDiv)) {
          messagesContainer.removeChild(loadingDiv);
        }
        
        // Show error message
        addMessage('Error communicating with server. Make sure the server is running on localhost:3000', 'ai');
      }
    });
  } catch (error) {
    console.error("General error:", error);
    // Remove loading indicator
    if (messagesContainer.contains(loadingDiv)) {
      messagesContainer.removeChild(loadingDiv);
    }
    
    // Show error message
    addMessage('Error: ' + error.message, 'ai');
  }
}

// Function to add a message to the chat
function addMessage(text, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}-message`;
  
  // Process markdown-like formatting (basic version)
  text = text
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Line breaks
    .replace(/\n/g, '<br>');
  
  messageDiv.innerHTML = text;
  messagesContainer.appendChild(messageDiv);
  
  // Scroll to the bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Debug helper function
function logDebug(message) {
  const debugDiv = document.createElement('div');
  debugDiv.className = 'message ai-message';
  debugDiv.style.color = 'red';
  debugDiv.textContent = 'DEBUG: ' + message;
  messagesContainer.appendChild(debugDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
} 