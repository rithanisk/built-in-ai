// Popup script for Smart Reading Companion
class SmartReadingCompanion {
  constructor() {
    this.currentTab = "summarizer";
    this.selectedText = "";
    this.apiKeys = {};
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.updateSelectedTextInfo();
    this.checkSelectedText();
    await this.waitForBackgroundScript();
    this.updateAIProviderIndicator();
    this.ensureFullWidth();
  }

  async waitForBackgroundScript() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max

      const checkBackground = () => {
        attempts++;

        if (attempts > maxAttempts) {
          console.log(
            "Background script not responding after maximum attempts"
          );
          resolve(); // Continue anyway
          return;
        }

        if (chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: "ping" }, (response) => {
            if (chrome.runtime.lastError) {
              console.log("Background script not ready, retrying...", attempts);
              setTimeout(checkBackground, 100);
            } else {
              console.log("Background script is ready");
              resolve();
            }
          });
        } else {
          setTimeout(checkBackground, 100);
        }
      };
      checkBackground();
    });
  }

  async loadSettings() {
    // No external API keys needed for Prompt API only mode
    this.apiKeys = {};
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll(".tab-button").forEach((button) => {
      button.addEventListener("click", (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Action buttons
    document
      .getElementById("summarizeBtn")
      .addEventListener("click", () => this.summarizeText());
    document
      .getElementById("translateBtn")
      .addEventListener("click", () => this.translateText());
    document
      .getElementById("proofreadBtn")
      .addEventListener("click", () => this.proofreadText());
    document
      .getElementById("askQuestion")
      .addEventListener("click", () => this.askQuestion());

    // Copy buttons
    document
      .getElementById("copySummary")
      .addEventListener("click", () => this.copyToClipboard("summaryOutput"));
    document
      .getElementById("copyTranslation")
      .addEventListener("click", () =>
        this.copyToClipboard("translationOutput")
      );
    document
      .getElementById("copyProofread")
      .addEventListener("click", () => this.copyToClipboard("proofreadOutput"));
    document
      .getElementById("copyQA")
      .addEventListener("click", () => this.copyToClipboard("qaOutput"));

    // Image upload
    document.getElementById("uploadImage").addEventListener("click", () => {
      document.getElementById("imageUpload").click();
    });
    document
      .getElementById("imageUpload")
      .addEventListener("change", (e) => this.handleImageUpload(e));

    // Settings
    document.getElementById("settingsBtn").addEventListener("click", () => {
      try {
        if (chrome.runtime && chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          console.log(
            "Extension context invalidated, cannot open options page"
          );
        }
      } catch (error) {
        console.log("Extension context invalidated:", error.message);
      }
    });

    // Auto-fill selected text
    document.querySelectorAll("textarea").forEach((textarea) => {
      textarea.addEventListener("focus", () => {
        if (!textarea.value && this.selectedText) {
          textarea.value = this.selectedText;
          this.updateSelectedTextInfo();
        }
      });
    });
  }

  switchTab(tabName) {
    // Update tab buttons
    document
      .querySelectorAll(".tab-button")
      .forEach((btn) => btn.classList.remove("active"));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");

    // Update tab panels
    document
      .querySelectorAll(".tab-panel")
      .forEach((panel) => panel.classList.remove("active"));
    document.getElementById(tabName).classList.add("active");

    this.currentTab = tabName;
  }

  async checkSelectedText() {
    try {
      // Check if extension context is valid
      if (!chrome.tabs || !chrome.tabs.query) {
        console.log(
          "Extension context invalidated, cannot check selected text"
        );
        return;
      }

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab || !tab.id) {
        console.log("No active tab found");
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "getSelectedText",
      });

      if (response && response.text) {
        this.selectedText = response.text;
        this.updateSelectedTextInfo();
      }
    } catch (error) {
      console.log(
        "No selected text or content script not ready:",
        error.message
      );
    }
  }

  updateSelectedTextInfo() {
    const length = this.selectedText.length;
    document.getElementById(
      "selectedTextLength"
    ).textContent = `${length} characters selected`;
  }

  async summarizeText() {
    const text = document.getElementById("summarizerText").value;
    if (!text.trim()) {
      this.showError("summaryOutput", "Please enter text to summarize");
      return;
    }

    this.showLoading("summaryOutput", "Summarizing...");

    try {
      const length = document.getElementById("summarizerLength").value;
      const result = await this.callAPI("summarize", { text, length });
      console.log("Summary result:", result);

      if (result && result.summary) {
        this.showResult("summaryOutput", result.summary);
      } else {
        console.error("No summary in result:", result);
        this.showError("summaryOutput", "No summary received from Built-in AI");
      }
    } catch (error) {
      console.error("Summarize error:", error);
      this.showError("summaryOutput", error.message);
    }
  }

  async translateText() {
    const text = document.getElementById("translatorText").value;
    if (!text.trim()) {
      this.showError("translationOutput", "Please enter text to translate");
      return;
    }

    this.showLoading("translationOutput", "Translating...");

    try {
      const sourceLang = document.getElementById("sourceLanguage").value;
      const targetLang = document.getElementById("targetLanguage").value;
      const result = await this.callAPI("translate", {
        text,
        sourceLang,
        targetLang,
      });
      this.showResult("translationOutput", result.translation);
    } catch (error) {
      this.showError("translationOutput", error.message);
    }
  }

  async proofreadText() {
    const text = document.getElementById("proofreaderText").value;
    if (!text.trim()) {
      this.showError("proofreadOutput", "Please enter text to proofread");
      return;
    }

    this.showLoading("proofreadOutput", "Proofreading...");

    try {
      const result = await this.callAPI("proofread", { text });
      this.showResult(
        "proofreadOutput",
        result.correctedText,
        result.suggestions
      );
    } catch (error) {
      this.showError("proofreadOutput", error.message);
    }
  }

  async askQuestion() {
    const text = document.getElementById("qaText").value;
    const imageFile = document.getElementById("imageUpload").files[0];

    if (!text.trim() && !imageFile) {
      this.showError("qaOutput", "Please enter text or upload an image");
      return;
    }

    this.showLoading("qaOutput", "Processing question...");

    try {
      const result = await this.callAPI("qa", { text, imageFile });
      this.showResult("qaOutput", result.answer);
    } catch (error) {
      this.showError("qaOutput", error.message);
    }
  }

  async callAPI(endpoint, data, retryCount = 0) {
    return new Promise((resolve, reject) => {
      try {
        // Check if extension context is valid
        if (!chrome.runtime || !chrome.runtime.sendMessage) {
          reject(
            new Error(
              "Extension context invalidated. Please reload the extension."
            )
          );
          return;
        }

        console.log("Sending API call:", {
          action: "apiCall",
          endpoint,
          data,
          retryCount,
        });

        chrome.runtime.sendMessage(
          {
            action: "apiCall",
            endpoint,
            data,
          },
          (response) => {
            console.log("Received response:", response);

            if (chrome.runtime.lastError) {
              console.error("Chrome runtime error:", chrome.runtime.lastError);

              // Retry once if it's a connection or context invalidation error
              if (
                (chrome.runtime.lastError.message.includes(
                  "Could not establish connection"
                ) ||
                  chrome.runtime.lastError.message.includes(
                    "Extension context invalidated"
                  )) &&
                retryCount < 1
              ) {
                console.log(
                  "Retrying API call due to connection/context error..."
                );
                setTimeout(() => {
                  this.callAPI(endpoint, data, retryCount + 1)
                    .then(resolve)
                    .catch(reject);
                }, 1000);
                return;
              }

              reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.error) {
              console.error("API error:", response.error);
              reject(new Error(response.error));
            } else if (response) {
              resolve(response);
            } else {
              reject(new Error("No response received from background script"));
            }
          }
        );
      } catch (error) {
        console.error("CallAPI error:", error);
        reject(new Error("Extension context invalidated: " + error.message));
      }
    });
  }

  showLoading(elementId, message) {
    const element = document.getElementById(elementId);
    element.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                ${message}
            </div>
        `;
    element.classList.add("loading");
  }

  showResult(elementId, content, suggestions = null) {
    const element = document.getElementById(elementId);
    element.classList.remove("loading");

    let html = `<div class="result-content">${content}</div>`;

    if (suggestions && suggestions.length > 0) {
      html += `<div class="suggestions">
                <h4>Suggestions:</h4>
                <ul>${suggestions.map((s) => `<li>${s}</li>`).join("")}</ul>
            </div>`;
    }

    element.innerHTML = html;
  }

  showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.classList.remove("loading");
    element.innerHTML = `<div class="error-message">${message}</div>`;
  }

  async copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    const text = element.textContent || element.innerText;

    try {
      await navigator.clipboard.writeText(text);
      this.showSuccess(elementId, "Copied to clipboard!");
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      this.showSuccess(elementId, "Copied to clipboard!");
    }
  }

  showSuccess(elementId, message) {
    const element = document.getElementById(elementId);
    const successDiv = document.createElement("div");
    successDiv.className = "success-message";
    successDiv.textContent = message;
    element.appendChild(successDiv);

    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.parentNode.removeChild(successDiv);
      }
    }, 3000);
  }

  handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        // Store image data for Q&A processing
        this.imageData = e.target.result;
        document.getElementById("qaText").placeholder =
          "Image uploaded. Ask a question about it...";
      };
      reader.readAsDataURL(file);
    }
  }

  ensureFullWidth() {
    // Ensure the popup takes full width
    const container = document.querySelector(".container");
    if (container) {
      container.style.width = "100%";
      container.style.minWidth = "380px";
      container.style.maxWidth = "400px";
    }

    // Ensure body takes full width
    document.body.style.width = "100%";
    document.body.style.minWidth = "380px";

    // Force a reflow to ensure changes take effect
    document.body.offsetHeight;
  }

  async updateAIProviderIndicator() {
    try {
      // Check if extension context is valid
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        console.log(
          "Extension context invalidated, cannot update AI provider indicator"
        );
        this.setAIProviderStatus("Extension context invalidated");
        return;
      }

      const response = await new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage(
            { action: "getPromptAPIStatus" },
            (response) => {
              if (chrome.runtime.lastError) {
                console.log(
                  "Extension context invalidated:",
                  chrome.runtime.lastError.message
                );
                resolve({ status: null });
              } else {
                resolve(response || { status: null });
              }
            }
          );
        } catch (error) {
          console.log("Extension context invalidated:", error.message);
          resolve({ status: null });
        }
      });

      const status = response.status;
      this.setAIProviderStatus(status);
    } catch (error) {
      console.error("Error updating AI provider indicator:", error);
      this.setAIProviderStatus(null);
    }
  }

  setAIProviderStatus(status) {
    const indicator = document.getElementById("aiProviderIndicator");
    if (!indicator) return;

    const providerText = indicator.querySelector(".provider-text");
    if (!providerText) return;

    if (status && status.isAvailable && status.hasSession) {
      providerText.textContent = "Using Built-in AI";
      indicator.style.display = "block";
    } else if (status && status.isAvailable) {
      providerText.textContent = "Built-in AI Available";
      indicator.style.display = "block";
    } else {
      providerText.textContent = "Built-in AI Not Available";
      indicator.style.display = "block";
    }
  }
}

// Initialize the extension when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new SmartReadingCompanion();
});
