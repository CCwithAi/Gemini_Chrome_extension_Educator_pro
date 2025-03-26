import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv-safe";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch";
import config from "./config.js";
import Default from "./plugins/Default.js";
import GeneralAssistant from "./plugins/GeneralAssistant.js";
import CodeTeacher from "./plugins/CodeTeacher.js";
dotenv.config();

const app = express().use(cors()).use(bodyParser.json({ limit: '10mb' }));
const port = 3000;

// Add a HEAD endpoint for status checking
app.head("/", (req, res) => {
  res.status(200).end();
});

// Function to perform a search
async function performSearch(query, currentSite = null) {
  const searchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  if (!searchApiKey || !searchEngineId) {
    throw new Error("Google Search API credentials not configured");
  }
  
  // Prepare the search query
  let finalQuery = query.trim();
  if (!finalQuery) {
    return "Please provide a search query.";
  }
  
  // If a site was provided and it's not a local domain, add the site: operator
  // but only if the query doesn't already include a site: operator
  if (!finalQuery.toLowerCase().includes('site:') && 
      currentSite && 
      !currentSite.includes('localhost') && 
      !currentSite.includes('127.0.0.1') &&
      !currentSite.includes('chrome-extension')) {
    finalQuery = `site:${currentSite} ${finalQuery}`;
    console.log(`Performing site-specific search for: ${finalQuery}`);
  } else {
    console.log(`Performing search for: ${finalQuery}`);
  }
  
  // Construct the search URL with appropriate parameters
  const url = `https://www.googleapis.com/customsearch/v1?key=${searchApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(finalQuery)}`;
  
  try {
    console.log(`Sending search request to URL: ${url}`);
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      console.error("Search API error details:", JSON.stringify(data));
      throw new Error(`Google Search API error: ${data.error?.message || response.statusText}. Status code: ${response.status}`);
    }
    
    // Format search results
    let formattedResults = `Search Results for "${finalQuery}":\n\n`;
    
    if (data.items && data.items.length > 0) {
      data.items.forEach((item, index) => {
        formattedResults += `${index + 1}. "${item.title}"\n`;
        formattedResults += `   URL: ${item.link}\n`;
        formattedResults += `   Snippet: ${item.snippet}\n\n`;
      });
    } else {
      formattedResults += "No results found.";
    }
    
    return formattedResults;
  } catch (error) {
    console.error("Search error:", error);
    throw error;
  }
}

// Process plugins and extract rules
function getPluginRules(feature) {
  let targetPlugin;
  
  // Select the appropriate plugin based on the feature
  if (feature === "chat") {
    // For Chat with Gemini overlay
    targetPlugin = config.plugins.find(plugin => plugin === Default);
  } else if (feature === "ask") {
    // For Ask Gemini (text selection)
    targetPlugin = config.plugins.find(plugin => plugin === GeneralAssistant);
  } else if (feature === "code-test") {
    // For Code-Tester
    targetPlugin = config.plugins.find(plugin => plugin === CodeTeacher);
  } else {
    // If no specific feature is mentioned, use Default
    targetPlugin = Default;
  }
  
  // If plugin not found or has no rules, fall back to Default
  if (!targetPlugin || !targetPlugin.rules) {
    targetPlugin = Default;
  }
  
  return targetPlugin.rules.join("\n\n");
}

// Process response with plugins
async function processResponseWithPlugins(response) {
  // Check each plugin for response processors
  for (const plugin of config.plugins) {
    if (plugin.processResponse) {
      const result = plugin.processResponse(response);
      
      // If it's a search request, perform the search
      if (result.isSearchRequest && result.searchQuery) {
        const searchResults = await performSearch(result.searchQuery);
        
        // Create a new prompt that includes the search results
        return {
          needsAdditionalProcessing: true,
          newPrompt: `I performed a search for "${result.searchQuery}" and found these results:\n\n${searchResults}\n\nPlease use this information to provide a comprehensive answer.`
        };
      }
    }
  }
  
  // If no plugin processing needed or no changes required
  return {
    needsAdditionalProcessing: false,
    response
  };
}

// Add near the beginning of your file, after dotenv.config()
async function verifySearchCredentials() {
  const searchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  if (!searchApiKey || !searchEngineId) {
    console.error("WARNING: Google Search API credentials not configured");
    return;
  }
  
  console.log("Verifying Google Search API credentials...");
  try {
    const testUrl = `https://www.googleapis.com/customsearch/v1?key=${searchApiKey}&cx=${searchEngineId}&q=test`;
    const response = await fetch(testUrl);
    const data = await response.json();
    
    if (!response.ok) {
      console.error("Google Search API verification failed:", data.error?.message || "Unknown error");
    } else {
      console.log("Google Search API credentials verified successfully");
    }
  } catch (error) {
    console.error("Google Search API verification failed:", error.message);
  }
}

app.post("/", async (req, res) => {
  try {
    // Initialize the Google Generative AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Get the model with the exact name from the example
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
    });
    
    const userMessage = req.body.message;
    const feature = req.body.feature || "default";
    const forceSearch = req.body.forceSearch || false; // Check if search is forced
    
    console.log(`Processing ${feature} request`);
    
    console.log(`Received ${feature} prompt (first 100 chars):`, userMessage.substring(0, 100) + "...");
    
    // Set up streaming response
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Use appropriate generation config for gemini-2.0-flash
    const generationConfig = {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    };
    
    // If search is forced, perform it directly
    if (forceSearch) {
      try {
        // Extract the search query from the message
        const searchQuery = userMessage.includes("Please search for information about: ") 
          ? userMessage.substring(userMessage.indexOf("Please search for information about: ") + 40).split("\n")[0].trim()
          : userMessage.trim();
        
        // Get the current site if provided
        const currentSite = req.body.currentSite || null;
        
        try {
          // Perform the search with site context if available
          const searchResults = await performSearch(searchQuery, currentSite);
          
          console.log("Search completed, generating response...");
          
          // Create a prompt with the search results
          const promptWithResults = `I searched for "${searchQuery}" ${currentSite ? `on ${currentSite}` : ''} and found these results:\n\n${searchResults}\n\nPlease analyze these results and provide a helpful response. If there are code examples, format them properly.`;
          
          // Use generateContent instead of streaming for better reliability
          const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: promptWithResults }] }],
            generationConfig,
          });
          
          const response = result.response;
          if (response.text) {
            console.log("Sending search response to client");
            res.write(response.text());
            res.end();
            return;
          } else {
            throw new Error("No text found in search response");
          }
        } catch (searchError) {
          console.error("Search error:", searchError);
          res.write(`Error performing search: ${searchError.message}`);
          res.end();
          return;
        }
      } catch (error) {
        console.error("Error processing search request:", error);
        res.write(`Error processing search request: ${error.message}`);
        res.end();
        return;
      }
    }
    
    // Get rules based on the feature
    const pluginRules = getPluginRules(feature);
    
    // Construct the full prompt with rules
    const fullPrompt = `${pluginRules}\n\nUser query: ${userMessage}`;
    
    // Try direct content generation first (non-streaming for reliability)
    try {
      console.log("Attempting direct content generation...");
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        generationConfig,
      });
      
      const response = result.response;
      let responseText = "";
      
      if (response.text) {
        responseText = response.text();
        res.write(responseText);
      } else if (response.candidates && response.candidates[0] && response.candidates[0].content) {
        responseText = response.candidates[0].content.parts[0].text;
        res.write(responseText);
      } else {
        throw new Error("Unable to extract text from response");
      }
      
      // Process the response with plugins
      try {
        const processedResult = await processResponseWithPlugins(responseText);
        
        if (processedResult.needsAdditionalProcessing) {
          // Generate a new response with the search results
          console.log("Performing additional processing (search)...");
          
          const followUpResult = await model.generateContent({
            contents: [
              { role: "user", parts: [{ text: fullPrompt }] },
              { role: "model", parts: [{ text: responseText }] },
              { role: "user", parts: [{ text: processedResult.newPrompt }] }
            ],
            generationConfig,
          });
          
          const followUpResponse = followUpResult.response;
          if (followUpResponse.text) {
            res.write("\n\n--- Additional Information from Search ---\n\n");
            res.write(followUpResponse.text());
          }
        }
      } catch (processingError) {
        console.error("Error processing response:", processingError);
      }
      
      res.end();
      return;
    } catch (directError) {
      console.error("Direct generation error:", directError);
      console.log("Falling back to chat session approach...");
    }
    
    // Fallback approach: try with chat session
    try {
      // Create a chat session
      const chatSession = model.startChat({
        generationConfig,
      });
      
      // Send message (non-streaming for reliability)
      const chatResult = await chatSession.sendMessage(fullPrompt);
      
      if (chatResult.response && chatResult.response.text) {
        res.write(chatResult.response.text());
      } else if (chatResult.response && chatResult.response.candidates && 
                chatResult.response.candidates[0] && 
                chatResult.response.candidates[0].content) {
        res.write(chatResult.response.candidates[0].content.parts[0].text);
      } else {
        throw new Error("Unable to extract text from chat response");
      }
      
      res.end();
    } catch (chatError) {
      console.error("Chat error:", chatError);
      
      // Last resort: simplified approach
      try {
        console.log("Trying simplified approach...");
        const simpleResult = await model.generateContent(fullPrompt);
        
        if (simpleResult.response && simpleResult.response.text) {
          res.write(simpleResult.response.text());
        } else {
          throw new Error("Unable to get response from simplified approach");
        }
        
        res.end();
      } catch (fallbackError) {
        console.error("All approaches failed:", fallbackError);
        res.status(500).send("Sorry, I'm having trouble generating a response. Please try again.");
      }
    }
  } catch (error) {
    console.error("Detailed server error:", error);
    console.error("Error stack:", error.stack);
    // Send a more informative error message
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Call this before starting the server
verifySearchCredentials().then(() => {
  app.listen(port, () => {
    console.log(`Chrome Gemini API listening on port ${port}`);
  });
});
