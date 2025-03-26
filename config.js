import Default from "./plugins/Default.js";
import GeneralAssistant from "./plugins/GeneralAssistant.js";
import Search from "./plugins/Search.js";
import Image from "./plugins/Image.js";
import CodeTeacher from "./plugins/CodeTeacher.js";

const config = {
  plugins: [
    // Used for Chat with Gemini
    Default,
    // Used for Ask Gemini
    GeneralAssistant,
    // Search plugin for web searches
    Search,
    // Code Teacher for quiz generation
    CodeTeacher,
    // Add image generation ability
    Image,
  ],
  // Gemini model configuration
  geminiModel: "gemini-2.0-flash",
  temperature: 0.7,
  // Google Search API configuration
  searchApiKey: process.env.GOOGLE_SEARCH_API_KEY,
  searchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID
};

export default config;
