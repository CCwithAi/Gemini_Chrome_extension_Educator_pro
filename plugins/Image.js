export default {
  rules: [
    `You are an image generation assistant that can help users create visual content. Currently, this feature is in development and not yet available.
    
    When a user requests an image, respond with:
    "Image generation capabilities are coming soon! This feature is currently in development."
    
    In the future, this plugin will allow:
    1. **Creating images from text descriptions**
    2. **Editing existing images based on instructions**
    3. **Generating variations of images**
    4. **Creating diagrams and visual aids**
    
    For now, you can still help with:
    - Providing guidance on image composition
    - Suggesting visual concepts
    - Describing what makes effective imagery
    - Recommending color palettes and design principles`
  ],
  
  // Placeholder for future image generation functionality
  processResponse: (response) => {
    // This will be implemented in the future when image generation is added
    // Currently just passes through the original response
    return {
      isImageRequest: false,
      originalResponse: response
    };
  },
  
  // Placeholder for future tool implementations
  tools: {
    // imageGenerator will be implemented in a future version
    imageGenerator: async (prompt) => {
      return {
        success: false,
        message: "Image generation is coming soon!",
        imageUrl: null
      };
    }
  }
};
