// Setup context menus on installation
chrome.runtime.onInstalled.addListener(() => {
  // Remove all existing context menus first to ensure a clean slate
  chrome.contextMenus.removeAll(() => {
    console.log("Existing context menus removed.");

    // Now create the context menu items
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

    chrome.contextMenus.create({
      id: "generate-image",
      title: "Generate Image",
      contexts: ["selection"],
    });

    console.log("Context menus created.");
  });
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
  } else if (info.menuItemId === "generate-image") {
    // Send a message to the content script to handle image generation
    chrome.tabs.sendMessage(tab.id, { type: "GENERATE_IMAGE", text: info.selectionText });
  }
});
