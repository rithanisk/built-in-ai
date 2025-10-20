// Options page script for Smart Reading Companion
class OptionsManager {
  constructor() {
    this.settings = {};
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.updateUI();
    this.loadUsageStats();
    this.updatePromptAPIStatus();
    this.startPromptAPIStatusPolling();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        "defaultSummarizerLength",
        "defaultTargetLanguage",
        "autoHighlight",
        "showNotifications",
      ]);

      this.settings = {
        defaultSummarizerLength: result.defaultSummarizerLength || "medium",
        defaultTargetLanguage: result.defaultTargetLanguage || "en",
        autoHighlight: result.autoHighlight !== false,
        showNotifications: result.showNotifications !== false,
      };
    } catch (error) {
      console.error("Error loading settings:", error);
      this.showStatus("Error loading settings", "error");
    }
  }

  setupEventListeners() {
    // Save button
    document.getElementById("saveSettings").addEventListener("click", () => {
      this.saveSettings();
    });

    // Reset statistics
    document.getElementById("resetStats").addEventListener("click", () => {
      this.resetStatistics();
    });

    // Auto-save on input change
    document.querySelectorAll("input, select").forEach((element) => {
      element.addEventListener("change", () => {
        this.updateSettingsFromUI();
      });
    });
  }

  updateUI() {
    // Update preferences
    document.getElementById("defaultSummarizerLength").value =
      this.settings.defaultSummarizerLength;
    document.getElementById("defaultTargetLanguage").value =
      this.settings.defaultTargetLanguage;
    document.getElementById("autoHighlight").checked =
      this.settings.autoHighlight;
    document.getElementById("showNotifications").checked =
      this.settings.showNotifications;
  }

  updateSettingsFromUI() {
    this.settings = {
      defaultSummarizerLength: document.getElementById(
        "defaultSummarizerLength"
      ).value,
      defaultTargetLanguage: document.getElementById("defaultTargetLanguage")
        .value,
      autoHighlight: document.getElementById("autoHighlight").checked,
      showNotifications: document.getElementById("showNotifications").checked,
    };
  }

  async saveSettings() {
    try {
      // Validate settings
      const validation = this.validateSettings();
      if (!validation.valid) {
        this.showStatus(validation.message, "error");
        return;
      }

      // Save to storage
      await chrome.storage.sync.set(this.settings);

      // Save to local storage for immediate access
      await chrome.storage.local.set({
        settings: this.settings,
        lastUpdated: Date.now(),
      });

      this.showStatus("Settings saved successfully!", "success");

      // Update UI
      this.updateUI();
    } catch (error) {
      console.error("Error saving settings:", error);
      this.showStatus("Error saving settings", "error");
    }
  }

  validateSettings() {
    // No validation needed for Prompt API only mode
    return { valid: true };
  }

  showStatus(message, type) {
    const statusElement = document.getElementById("saveStatus");
    statusElement.textContent = message;
    statusElement.className = `save-status ${type}`;

    setTimeout(() => {
      statusElement.textContent = "";
      statusElement.className = "save-status";
    }, 3000);
  }

  async loadUsageStats() {
    try {
      const result = await chrome.storage.local.get([
        "totalSummaries",
        "totalTranslations",
        "totalProofreads",
        "totalQuestions",
      ]);

      document.getElementById("totalSummaries").textContent =
        result.totalSummaries || 0;
      document.getElementById("totalTranslations").textContent =
        result.totalTranslations || 0;
      document.getElementById("totalProofreads").textContent =
        result.totalProofreads || 0;
      document.getElementById("totalQuestions").textContent =
        result.totalQuestions || 0;
    } catch (error) {
      console.error("Error loading usage stats:", error);
    }
  }

  async resetStatistics() {
    if (
      confirm(
        "Are you sure you want to reset all usage statistics? This action cannot be undone."
      )
    ) {
      try {
        await chrome.storage.local.remove([
          "totalSummaries",
          "totalTranslations",
          "totalProofreads",
          "totalQuestions",
        ]);

        this.loadUsageStats();
        this.showStatus("Statistics reset successfully!", "success");
      } catch (error) {
        console.error("Error resetting statistics:", error);
        this.showStatus("Error resetting statistics", "error");
      }
    }
  }

  async updatePromptAPIStatus() {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: "getPromptAPIStatus" },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve({ status: null });
            } else {
              resolve(response);
            }
          }
        );
      });

      const status = response.status;
      if (status) {
        this.updatePromptAPIUI(status);
      } else {
        this.updatePromptAPIUI({
          isAvailable: false,
          isDownloading: false,
          downloadProgress: 0,
          hasSession: false,
          modelParams: null,
        });
      }
    } catch (error) {
      console.error("Error getting Prompt API status:", error);
      this.updatePromptAPIUI({
        isAvailable: false,
        isDownloading: false,
        downloadProgress: 0,
        hasSession: false,
        modelParams: null,
      });
    }
  }

  updatePromptAPIUI(status) {
    const statusElement = document.getElementById("promptAPIStatus");
    const availabilityElement = document.getElementById(
      "promptAPIAvailability"
    );
    const downloadProgressElement = document.getElementById(
      "promptAPIDownloadProgress"
    );
    const paramsElement = document.getElementById("promptAPIParams");
    const downloadBar = document.getElementById("promptAPIDownloadBar");
    const progressFill = document.getElementById("progressFill");
    const progressText = document.getElementById("progressText");

    // Update status indicator
    if (status.isAvailable && status.hasSession) {
      statusElement.textContent = "Ready";
      statusElement.className = "api-status configured";
    } else if (status.isAvailable && status.isDownloading) {
      statusElement.textContent = "Downloading...";
      statusElement.className = "api-status not-configured";
    } else if (status.isAvailable) {
      statusElement.textContent = "Available";
      statusElement.className = "api-status configured";
    } else {
      statusElement.textContent = "Unavailable";
      statusElement.className = "api-status not-configured";
    }

    // Update availability
    if (status.isAvailable) {
      availabilityElement.textContent = status.hasSession
        ? "Ready"
        : "Available";
    } else {
      availabilityElement.textContent = "Unavailable";
    }

    // Update download progress
    if (status.isDownloading) {
      downloadProgressElement.textContent = `${Math.round(
        status.downloadProgress
      )}%`;
      downloadBar.style.display = "block";
      progressFill.style.width = `${status.downloadProgress}%`;
      progressText.textContent = `${Math.round(status.downloadProgress)}%`;
    } else {
      downloadProgressElement.textContent = status.hasSession
        ? "Complete"
        : "-";
      downloadBar.style.display = "none";
    }

    // Update model parameters
    if (status.modelParams) {
      paramsElement.textContent = `Temp: ${status.modelParams.defaultTemperature}, TopK: ${status.modelParams.defaultTopK}`;
    } else {
      paramsElement.textContent = "-";
    }
  }

  startPromptAPIStatusPolling() {
    // Poll for Prompt API status updates every 2 seconds
    setInterval(() => {
      this.updatePromptAPIStatus();
    }, 2000);

    // Also listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local" && changes.promptAPIStatus) {
        this.updatePromptAPIUI(changes.promptAPIStatus.newValue);
      }
      if (namespace === "local" && changes.promptAPIDownloadProgress) {
        const progress = changes.promptAPIDownloadProgress.newValue;
        const progressFill = document.getElementById("progressFill");
        const progressText = document.getElementById("progressText");
        const downloadProgressElement = document.getElementById(
          "promptAPIDownloadProgress"
        );

        if (progressFill && progressText && downloadProgressElement) {
          progressFill.style.width = `${progress}%`;
          progressText.textContent = `${Math.round(progress)}%`;
          downloadProgressElement.textContent = `${Math.round(progress)}%`;
        }
      }
    });
  }
}

// Initialize options manager when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new OptionsManager();
});
