import { GoogleGenerativeAI } from '@google/generative-ai';

class Image {
  constructor() {
    this.rules = [
      "You are an image generation assistant.",
      "When generating images, focus on creating clear, detailed descriptions.",
      "Always ensure the prompt is safe and appropriate.",
      "Format the prompt to work well with Gemini's image generation model."
    ];
  }

  static async generateImage(prompt) {
    try {
      // Initialize the API with the key from environment
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      
      // IMPORTANT: Use the correct model for image generation
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp-image-generation", // This is the key change
      });

      // Format the prompt
      const formattedPrompt = this.formatPrompt(prompt);
      console.log("Using image generation prompt:", formattedPrompt);

      // Use chat session approach as in documentation
      const chatSession = model.startChat({
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
          responseModalities: ["image", "text"], // Request both image and text
        }
      });

      // Send the message to generate content
      const result = await chatSession.sendMessage(`Create an image of: ${formattedPrompt}`);
      
      // Process the response to extract image data
      if (result.response && result.response.candidates) {
        for (const candidate of result.response.candidates) {
          if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
              if (part.inlineData && part.inlineData.data && part.inlineData.mimeType) {
                console.log("Successfully extracted image data");
                return {
                  data: part.inlineData.data,
                  mimeType: part.inlineData.mimeType
                };
              }
            }
          }
        }
      }
      
      console.log("Response structure:", JSON.stringify(result.response, null, 2));
      throw new Error("No image data found in response");
    } catch (error) {
      console.error('Image generation error:', error);
      throw error;
    }
  }

  processResponse(response) {
    // Check if this is an image generation request
    if (response.toLowerCase().includes('generate an image') || 
        response.toLowerCase().includes('create an image')) {
      return {
        isImageRequest: true,
        prompt: response
      };
    }
    return { isImageRequest: false };
  }

  static formatPrompt(text) {
    // Clean and format the text for image generation
    let formattedText = text.trim()
      .replace(/[^\w\s,.!?-]/g, '') // Remove special characters
      .replace(/\s+/g, ' '); // Normalize whitespace

    // Enhance the prompt if needed
    if (!formattedText.toLowerCase().includes('generate') && 
        !formattedText.toLowerCase().includes('create')) {
      formattedText = `Generate a detailed, high-quality image of: ${formattedText}`;
    }

    // Add specific style guidance for better results
    formattedText += `, high resolution, professional quality, detailed lighting and textures`;

    return formattedText;
  }
}

export default Image;