// Create context menu items
chrome.contextMenus.create({
  id: "ask-gemini",
  title: "Ask Gemini",
  contexts: ["selection"],
});

chrome.contextMenus.create({
  id: "chat-with-gemini",
  title: "Chat with Gemini",
  contexts: ["all"],
});

chrome.contextMenus.create({
  id: "code-tester",
  title: "Educator Pro Mode",
  contexts: ["page"],
});

// Listen for when the user clicks on the context menu items
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "ask-gemini") {
    // Send a message to the content script
    chrome.tabs.sendMessage(tab.id, { type: "ASK_CHATGPT" });
  } else if (info.menuItemId === "chat-with-gemini") {
    // Send a message to the content script to open the chat overlay
    chrome.tabs.sendMessage(tab.id, { type: "OPEN_GEMINI_CHAT" });
  } else if (info.menuItemId === "code-tester") {
    // Send message to content script to activate the Code-Tester
    chrome.tabs.sendMessage(tab.id, { type: "CODE_TESTER" });
  }
});
