// Prompt API Service for Smart Reading Companion
class PromptAPIService {
  constructor() {
    this.session = null;
    this.isAvailable = false;
    this.isDownloading = false;
    this.downloadProgress = 0;
    this.modelParams = null;
    this.init();
  }

  async init() {
    try {
      // Check if LanguageModel API is available first
      if (typeof LanguageModel === "undefined") {
        console.log("Built-in AI not available: LanguageModel API not found");
        this.isAvailable = false;
        return;
      }

      // Check if Prompt API is available
      await this.checkAvailability();

      if (this.isAvailable) {
        // Get model parameters
        this.modelParams = await LanguageModel.params();
        console.log("Built-in AI parameters:", this.modelParams);
      }
    } catch (error) {
      console.log("Built-in AI not available:", error);
      this.isAvailable = false;
    }
  }

  async checkAvailability() {
    try {
      // Check if LanguageModel API is available
      if (typeof LanguageModel === "undefined") {
        console.log("Built-in AI not available: LanguageModel API not found");
        this.isAvailable = false;
        return false;
      }

      const availability = await LanguageModel.availability();
      console.log("Built-in AI availability:", availability);

      switch (availability) {
        case "available":
          this.isAvailable = true;
          this.isDownloading = false;
          break;
        case "downloadable":
        case "downloading":
          this.isAvailable = true;
          this.isDownloading = true;
          break;
        case "unavailable":
        default:
          this.isAvailable = false;
          this.isDownloading = false;
          break;
      }

      return this.isAvailable;
    } catch (error) {
      console.error("Error checking Built-in AI availability:", error);
      this.isAvailable = false;
      return false;
    }
  }

  async createSession(options = {}) {
    if (!this.isAvailable) {
      throw new Error("Built-in AI is not available");
    }

    if (typeof LanguageModel === "undefined") {
      throw new Error("Built-in AI is not supported in this Chrome version");
    }

    try {
      const sessionOptions = {
        temperature:
          options.temperature || this.modelParams?.defaultTemperature || 1.0,
        topK: options.topK || this.modelParams?.defaultTopK || 3,
        monitor: (m) => {
          m.addEventListener("downloadprogress", (e) => {
            this.downloadProgress = e.loaded * 100;
            console.log(`Model download progress: ${this.downloadProgress}%`);

            // Notify background script of download progress
            try {
              chrome.runtime.sendMessage({
                action: "downloadProgress",
                progress: this.downloadProgress,
              });
            } catch (error) {
              console.log(
                "Error sending download progress message:",
                error.message
              );
            }
          });
        },
      };

      this.session = await LanguageModel.create(sessionOptions);
      this.isDownloading = false;
      this.downloadProgress = 100;

      console.log("Built-in AI session created successfully");
      return this.session;
    } catch (error) {
      console.error("Error creating Built-in AI session:", error);
      throw error;
    }
  }

  async ensureSession() {
    if (!this.session) {
      await this.createSession();
    }
    return this.session;
  }

  async summarizeText(text, length = "medium") {
    const session = await this.ensureSession();

    const lengthInstructions = {
      short: "Provide a brief summary in 1-2 sentences.",
      medium: "Provide a concise summary in 2-3 sentences.",
      long: "Provide a detailed summary in 3-5 sentences.",
    };

    const prompt = `You are a helpful assistant that summarizes text. ${lengthInstructions[length]}

Please summarize the following text:

${text}`;

    try {
      const response = await session.prompt(prompt);
      console.log("Built-in AI response:", response);

      // Handle different response structures
      if (response && response.text) {
        return { summary: response.text };
      } else if (typeof response === "string") {
        return { summary: response };
      } else {
        console.error("Unexpected response structure:", response);
        throw new Error("Unexpected response from Built-in AI");
      }
    } catch (error) {
      console.error("Error summarizing with Built-in AI:", error);
      throw error;
    }
  }

  async translateText(text, sourceLang = "auto", targetLang = "en") {
    const session = await this.ensureSession();

    const languageNames = {
      en: "English",
      es: "Spanish",
      fr: "French",
      de: "German",
      it: "Italian",
      pt: "Portuguese",
      ru: "Russian",
      ja: "Japanese",
      ko: "Korean",
      zh: "Chinese",
    };

    const sourceLanguage =
      sourceLang === "auto"
        ? "the detected language"
        : languageNames[sourceLang];
    const targetLanguage = languageNames[targetLang];

    const prompt = `You are a professional translator. Translate the given text from ${sourceLanguage} to ${targetLanguage}. Provide only the translation without any additional text.

Text to translate: ${text}`;

    try {
      const response = await session.prompt(prompt);
      return { translation: response.text };
    } catch (error) {
      console.error("Error translating with Built-in AI:", error);
      throw error;
    }
  }

  async proofreadText(text) {
    const session = await this.ensureSession();

    const prompt = `You are a professional proofreader. Correct grammar, spelling, punctuation, and style issues in the provided text. Return the corrected text first, then provide a list of the main corrections made.

Text to proofread: ${text}`;

    try {
      const response = await session.prompt(prompt);
      const responseText = response.text.trim();

      // Extract corrected text and suggestions
      const lines = responseText.split("\n");
      const correctedText = lines[0];
      const suggestions = lines
        .slice(1)
        .filter(
          (line) => line.trim().startsWith("-") || line.trim().startsWith("•")
        );

      return {
        correctedText,
        suggestions: suggestions.map((s) => s.replace(/^[-•]\s*/, "").trim()),
      };
    } catch (error) {
      console.error("Error proofreading with Built-in AI:", error);
      throw error;
    }
  }

  async askQuestion(text, question = "") {
    const session = await this.ensureSession();

    const prompt = `You are a helpful assistant that can answer questions about text. Provide clear, accurate, and helpful responses.

Text: ${text}

Question: ${question || "Please analyze this text and provide insights."}`;

    try {
      const response = await session.prompt(prompt);
      return { answer: response.text };
    } catch (error) {
      console.error("Error answering question with Built-in AI:", error);
      throw error;
    }
  }

  async promptStreaming(prompt, onChunk) {
    const session = await this.ensureSession();

    try {
      const stream = await session.promptStreaming(prompt);

      for await (const chunk of stream) {
        if (onChunk) {
          onChunk(chunk.text);
        }
      }
    } catch (error) {
      console.error("Error with Built-in AI streaming:", error);
      throw error;
    }
  }

  getStatus() {
    return {
      isAvailable: this.isAvailable,
      isDownloading: this.isDownloading,
      downloadProgress: this.downloadProgress,
      hasSession: !!this.session,
      modelParams: this.modelParams,
    };
  }

  async reset() {
    this.session = null;
    this.isAvailable = false;
    this.isDownloading = false;
    this.downloadProgress = 0;
    this.modelParams = null;
    await this.init();
  }
}

// Background script for Smart Reading Companion
class BackgroundService {
  constructor() {
    this.promptAPI = null;
    this.contextMenusSetup = false;
    this.init();
  }

  async init() {
    console.log("Initializing background service");
    this.setupMessageListener();
    await this.setupContextMenus();
    await this.initializePromptAPI();
    console.log("Background service initialized");
  }

  async initializePromptAPI() {
    try {
      // Check if Prompt API is available
      if (typeof LanguageModel !== "undefined") {
        this.promptAPI = new PromptAPIService();
        const isAvailable = await this.promptAPI.checkAvailability();

        if (isAvailable) {
          console.log("Built-in AI (Prompt API) initialized successfully");
          // Store Prompt API status
          await chrome.storage.local.set({
            promptAPIStatus: this.promptAPI.getStatus(),
          });
        }
      }
    } catch (error) {
      console.log("Built-in AI not available:", error);
      this.promptAPI = null;
    }
  }

  setupMessageListener() {
    console.log("Setting up message listener");
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log("Received message:", request.action);
      // Handle the message asynchronously
      this.handleMessage(request, sender, sendResponse);
      // Return true to indicate we will send a response asynchronously
      return true;
    });
    console.log("Message listener set up successfully");
  }

  async setupContextMenus() {
    try {
      // Check if contextMenus API is available
      if (!chrome.contextMenus) {
        console.warn("Context menus API not available");
        return;
      }

      // Prevent duplicate setup
      if (this.contextMenusSetup) {
        console.log("Context menus already set up, skipping...");
        return;
      }

      // Clear existing context menus first
      await chrome.contextMenus.removeAll();

      // Create context menu items
      chrome.contextMenus.create({
        id: "smart-reading-summarize",
        title: "Summarize with Smart Reading",
        contexts: ["selection"],
      });

      chrome.contextMenus.create({
        id: "smart-reading-translate",
        title: "Translate with Smart Reading",
        contexts: ["selection"],
      });

      chrome.contextMenus.create({
        id: "smart-reading-proofread",
        title: "Proofread with Smart Reading",
        contexts: ["selection"],
      });

      chrome.contextMenus.create({
        id: "smart-reading-qa",
        title: "Ask Question about Selection",
        contexts: ["selection"],
      });

      // Add click listener (only once)
      chrome.contextMenus.onClicked.addListener((info, tab) => {
        this.handleContextMenuClick(info, tab);
      });

      this.contextMenusSetup = true;
      console.log("Context menus created successfully");
    } catch (error) {
      console.error("Error setting up context menus:", error);
    }
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case "ping":
          console.log("Received ping from popup");
          sendResponse({
            success: true,
            message: "Background script is ready",
          });
          break;
        case "apiCall":
          try {
            const result = await this.makeAPICall(
              request.endpoint,
              request.data
            );
            sendResponse(result);
          } catch (error) {
            console.error("API call error:", error);
            sendResponse({ error: error.message });
          }
          break;
        case "textSelected":
          // Store selected text for popup access
          chrome.storage.local.set({ lastSelectedText: request.text });
          sendResponse({ success: true });
          break;
        case "highlightClicked":
          // Open popup with Q&A tab
          chrome.action.openPopup();
          sendResponse({ success: true });
          break;
        case "getPromptAPIStatus":
          const status = this.promptAPI ? this.promptAPI.getStatus() : null;
          sendResponse({ status });
          break;
        case "downloadProgress":
          // Update download progress in storage
          await chrome.storage.local.set({
            promptAPIDownloadProgress: request.progress,
          });
          sendResponse({ success: true });
          break;
        default:
          sendResponse({ error: "Unknown action" });
      }
    } catch (error) {
      console.error("Background script error:", error);
      sendResponse({ error: error.message });
    }

    // Return true to indicate we will send a response asynchronously
    return true;
  }

  async handleContextMenuClick(info, tab) {
    const selectedText = info.selectionText;
    if (!selectedText) return;

    try {
      switch (info.menuItemId) {
        case "smart-reading-summarize":
          await this.processText(selectedText, "summarize");
          break;
        case "smart-reading-translate":
          await this.processText(selectedText, "translate");
          break;
        case "smart-reading-proofread":
          await this.processText(selectedText, "proofread");
          break;
        case "smart-reading-qa":
          await this.processText(selectedText, "qa");
          break;
      }
    } catch (error) {
      console.error("Context menu error:", error);
    }
  }

  async processText(text, action) {
    // Open popup and send text
    chrome.action.openPopup();

    // Wait a bit for popup to open, then send message
    setTimeout(() => {
      try {
        chrome.runtime.sendMessage({
          action: "processText",
          text: text,
          actionType: action,
        });
      } catch (error) {
        console.log("Error sending processText message:", error.message);
      }
    }, 500);
  }

  async makeAPICall(endpoint, data) {
    // Use Built-in AI only
    if (!this.promptAPI || !this.promptAPI.isAvailable) {
      if (typeof LanguageModel === "undefined") {
        throw new Error(
          "Built-in AI is not supported in this Chrome version. Please update to Chrome 88+ with Prompt API support enabled."
        );
      }
      throw new Error(
        "Built-in AI is not available. Please ensure you're using Chrome 88+ with Prompt API support enabled. This extension only uses Google's built-in AI - no external APIs required."
      );
    }

    try {
      switch (endpoint) {
        case "summarize":
          return await this.promptAPI.summarizeText(data.text, data.length);
        case "translate":
          return await this.promptAPI.translateText(
            data.text,
            data.sourceLang,
            data.targetLang
          );
        case "proofread":
          return await this.promptAPI.proofreadText(data.text);
        case "qa":
          return await this.promptAPI.askQuestion(data.text, data.question);
        default:
          throw new Error("Unknown endpoint");
      }
    } catch (error) {
      console.error("Built-in AI error:", error);
      throw new Error(`Built-in AI processing failed: ${error.message}`);
    }
  }
}

// Global error handler for unhandled promise rejections
self.addEventListener("unhandledrejection", (event) => {
  console.log(
    "Caught unhandled promise rejection in background script:",
    event.reason
  );
  event.preventDefault();
});

// Global error handler for uncaught errors
self.addEventListener("error", (event) => {
  console.log("Caught uncaught error in background script:", event.error);
  event.preventDefault();
});

// Initialize background service
console.log("Creating background service instance");
const backgroundService = new BackgroundService();
console.log("Background service instance created");
