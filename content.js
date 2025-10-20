// Content script for Smart Reading Companion
class ContentScript {
  constructor() {
    this.selectedText = "";
    this.highlightedElements = [];
    this.isContextValid = true;
    this.init();
  }

  init() {
    // Check if extension context is valid before initializing
    if (!this.isExtensionContextValid()) {
      console.log(
        "Extension context invalidated, content script will not initialize"
      );
      this.isContextValid = false;
      return;
    }

    this.setupEventListeners();
    this.setupMessageListener();
  }

  isExtensionContextValid() {
    try {
      // Check if chrome object exists and has the required properties
      if (typeof chrome === "undefined" || !chrome) {
        return false;
      }

      if (!chrome.runtime) {
        return false;
      }

      if (typeof chrome.runtime.sendMessage !== "function") {
        return false;
      }

      // Try to access the runtime to see if it's still valid
      chrome.runtime.id;
      return true;
    } catch (error) {
      console.log("Extension context validation failed:", error.message);
      return false;
    }
  }

  setupEventListeners() {
    // Listen for text selection
    document.addEventListener("mouseup", (e) => {
      setTimeout(() => this.handleTextSelection(), 100);
    });

    // Listen for keyboard selection
    document.addEventListener("keyup", (e) => {
      if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "Shift"
      ) {
        setTimeout(() => this.handleTextSelection(), 100);
      }
    });

    // Listen for click events to clear highlights
    document.addEventListener("click", (e) => {
      if (!e.target.classList.contains("smart-reading-highlight")) {
        this.clearHighlights();
      }
    });
  }

  setupMessageListener() {
    try {
      if (!chrome.runtime || !chrome.runtime.onMessage) {
        console.log(
          "Extension context invalidated, cannot setup message listener"
        );
        return;
      }

      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        try {
          switch (request.action) {
            case "getSelectedText":
              sendResponse({ text: this.selectedText });
              break;
            case "highlightText":
              this.highlightText(request.text);
              sendResponse({ success: true });
              break;
            case "clearHighlights":
              this.clearHighlights();
              sendResponse({ success: true });
              break;
            case "extractImages":
              this.extractImages().then((images) => {
                sendResponse({ images });
              });
              return true; // Keep message channel open for async response
          }
        } catch (error) {
          console.log("Error handling message:", error.message);
          sendResponse({ error: error.message });
        }
      });
    } catch (error) {
      console.log(
        "Extension context invalidated, cannot setup message listener:",
        error.message
      );
    }
  }

  handleTextSelection() {
    try {
      if (!this.isContextValid) return;

      const selection = window.getSelection();
      const text = selection.toString().trim();

      if (text && text !== this.selectedText) {
        this.selectedText = text;
        this.highlightSelectedText(selection);
        this.notifyPopup();
      } else if (!text) {
        this.selectedText = "";
        this.clearHighlights();
      }
    } catch (error) {
      console.log("Error in handleTextSelection:", error.message);
      this.isContextValid = false;
    }
  }

  highlightSelectedText(selection) {
    this.clearHighlights();

    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const span = document.createElement("span");
      span.className = "smart-reading-highlight";
      span.style.cssText = `
                background-color: rgba(102, 126, 234, 0.3);
                border-radius: 3px;
                padding: 1px 2px;
                cursor: pointer;
                transition: background-color 0.2s;
            `;

      try {
        range.surroundContents(span);
        this.highlightedElements.push(span);

        // Add hover effect
        span.addEventListener("mouseenter", () => {
          span.style.backgroundColor = "rgba(102, 126, 234, 0.5)";
        });

        span.addEventListener("mouseleave", () => {
          span.style.backgroundColor = "rgba(102, 126, 234, 0.3)";
        });

        // Add click handler for Q&A
        span.addEventListener("click", (e) => {
          e.stopPropagation();
          this.handleHighlightClick(span.textContent);
        });
      } catch (error) {
        console.log("Could not highlight selection:", error.message);
        // Don't re-throw the error, just log it and continue
      }
    }
  }

  clearHighlights() {
    this.highlightedElements.forEach((element) => {
      const parent = element.parentNode;
      if (parent) {
        parent.replaceChild(
          document.createTextNode(element.textContent),
          element
        );
        parent.normalize();
      }
    });
    this.highlightedElements = [];
  }

  handleHighlightClick(text) {
    try {
      // Send message to popup to open Q&A tab with selected text
      this.sendMessage({
        action: "highlightClicked",
        text: text,
      });
    } catch (error) {
      console.log("Error in handleHighlightClick:", error.message);
      this.isContextValid = false;
    }
  }

  notifyPopup() {
    try {
      // Notify popup about text selection
      this.sendMessage({
        action: "textSelected",
        text: this.selectedText,
      });
    } catch (error) {
      console.log("Error in notifyPopup:", error.message);
      this.isContextValid = false;
    }
  }

  sendMessage(message) {
    try {
      // Check if extension context is still valid
      if (!this.isExtensionContextValid()) {
        console.log("Extension context invalidated, skipping message");
        this.isContextValid = false;
        return;
      }

      // Additional safety check
      if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        console.log("Chrome runtime not available, skipping message");
        this.isContextValid = false;
        return;
      }

      try {
        chrome.runtime.sendMessage(message, (response) => {
          try {
            if (chrome.runtime && chrome.runtime.lastError) {
              console.log(
                "Extension context invalidated:",
                chrome.runtime.lastError.message
              );
              this.isContextValid = false;
            }
          } catch (callbackError) {
            console.log(
              "Error in sendMessage callback:",
              callbackError.message
            );
            this.isContextValid = false;
          }
        });
      } catch (sendError) {
        console.log("Error sending message:", sendError.message);
        this.isContextValid = false;
      }
    } catch (error) {
      console.log("Extension context invalidated:", error.message);
      this.isContextValid = false;
    }
  }

  highlightText(text) {
    this.clearHighlights();

    if (!text) return;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const textNodes = [];
    let node;

    while ((node = walker.nextNode())) {
      if (node.textContent.includes(text)) {
        textNodes.push(node);
      }
    }

    textNodes.forEach((textNode) => {
      const parent = textNode.parentNode;
      const text = textNode.textContent;
      const index = text.indexOf(text);

      if (index !== -1) {
        const beforeText = text.substring(0, index);
        const matchText = text.substring(index, index + text.length);
        const afterText = text.substring(index + text.length);

        const beforeNode = document.createTextNode(beforeText);
        const afterNode = document.createTextNode(afterText);

        const span = document.createElement("span");
        span.className = "smart-reading-highlight";
        span.style.cssText = `
                    background-color: rgba(102, 126, 234, 0.3);
                    border-radius: 3px;
                    padding: 1px 2px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                `;
        span.textContent = matchText;

        parent.replaceChild(afterNode, textNode);
        parent.insertBefore(span, afterNode);
        parent.insertBefore(beforeNode, span);

        this.highlightedElements.push(span);
      }
    });
  }

  async extractImages() {
    const images = [];
    const imgElements = document.querySelectorAll("img");

    for (const img of imgElements) {
      try {
        // Skip very small images (likely icons)
        if (img.naturalWidth < 50 || img.naturalHeight < 50) continue;

        const rect = img.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        // Convert image to base64
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL("image/png");

        images.push({
          src: img.src,
          alt: img.alt || "",
          width: img.naturalWidth,
          height: img.naturalHeight,
          dataURL: dataURL,
          rect: {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height,
          },
        });
      } catch (error) {
        console.log("Error extracting image:", error);
      }
    }

    return images;
  }
}

// Global error handler for uncaught extension context errors
window.addEventListener("error", (event) => {
  if (
    event.error &&
    event.error.message &&
    event.error.message.includes("Extension context invalidated")
  ) {
    console.log("Caught extension context error:", event.error.message);
    event.preventDefault();
    return true;
  }
});

// Global unhandled promise rejection handler
window.addEventListener("unhandledrejection", (event) => {
  if (
    event.reason &&
    event.reason.message &&
    (event.reason.message.includes("Extension context invalidated") ||
      event.reason.message.includes("Could not establish connection"))
  ) {
    console.log(
      "Caught extension context promise rejection:",
      event.reason.message
    );
    event.preventDefault();
    return true;
  }
});

// Initialize content script with context validation
function initializeContentScript() {
  try {
    // Check if extension context is valid before creating content script
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      new ContentScript();
    } else {
      console.log(
        "Extension context invalidated, content script not initialized"
      );
    }
  } catch (error) {
    console.log("Extension context invalidated:", error.message);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeContentScript);
} else {
  initializeContentScript();
}
