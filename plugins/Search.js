export default {
  rules: [
    `You have a powerful search capability that allows you to find information and code snippets from across the web. Use this search tool proactively in the following scenarios:

    1. **General Information Searches:**
       - When the user explicitly asks for current information
       - When you need to verify facts or provide up-to-date information
       - When you're unsure about the answer or need more context
       - When the user asks for information about recent events or technologies

    2. **Code-Specific Searches:**
       - When the user asks for code examples or implementations
       - When the user wants to know how to solve a specific programming problem
       - When you need to find documentation or API references
       - When the user asks about best practices or patterns for specific technologies

    To use the search tool, respond with:
    <<SEARCH: your specific search query>>
    
    For code-related searches, make your queries specific and include relevant keywords:
    <<SEARCH: javascript example fetch API with error handling>>
    <<SEARCH: python pandas dataframe filter multiple conditions>>

    For more effective code searches, include language, framework, and specific functionality:
    <<SEARCH: React hooks useEffect cleanup example>>
    <<SEARCH: PostgreSQL recursive query common table expression>>

    After getting search results:
    1. Analyze them carefully to find the most relevant information
    2. Extract and format code snippets properly with appropriate syntax highlighting
    3. Provide explanations alongside any code you share
    4. Always cite sources when possible
    5. Clearly indicate when information comes from search results versus your own knowledge

    When sharing code snippets:
    - Include complete, working examples when possible
    - Explain key parts of the code
    - Mention any dependencies or prerequisites
    - Suggest modifications that might better suit the user's specific needs`
  ],
  
  // Process responses to detect search requests
  processResponse: (response) => {
    // Check if the response contains a search request
    const searchMatch = response.match(/<<SEARCH:\s*([^>]+)>>/);
    if (searchMatch) {
      const searchQuery = searchMatch[1].trim();
      // Return the search query to be processed by the server
      return {
        isSearchRequest: true,
        searchQuery,
        originalResponse: response
      };
    }
    
    // If no search request is found, return the original response
    return {
      isSearchRequest: false,
      originalResponse: response
    };
  }
}; 