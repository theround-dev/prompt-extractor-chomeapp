let isProcessing = false;
let responseObserver = null;
let siteHandler = null;

// Site detection and handler initialization
function detectSiteAndInitialize() {
  const hostname = window.location.hostname;
  console.log('Detected hostname:', hostname);
  
  if (hostname.includes('deepseek.com')) {
    console.log('Initializing DeepSeek handler');
    siteHandler = new DeepSeekHandler();
  } else if (hostname.includes('chatgpt.com')) {
    console.log('Initializing OpenAI handler');
    siteHandler = new OpenAIHandler();
  } else {
    console.error('Unsupported site:', hostname);
    return false;
  }
  
  console.log(`Initialized ${siteHandler.siteName} handler`);
  return true;
}

// Initialize site handler when script loads
if (!detectSiteAndInitialize()) {
  console.error('Failed to initialize site handler');
}

// Notify background script that content script is ready
chrome.runtime.sendMessage({ type: "ready" });

// Listen for messages from background script
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log('Content script received:', request.type);
  
  if (request.type === "nextPrompt") {
    if (!isProcessing) {
      await submitPrompt(request.prompt);
    } else {
      console.log('Still processing previous prompt, skipping...');
    }
  } else if (request.type === "ready") {
    sendResponse({ status: "ready" });
  }
});

async function submitPrompt(prompt) {
  try {
    isProcessing = true;
    console.log(`Submitting prompt to ${siteHandler.siteName}:`, prompt);
    
    // Clear response cache for new prompt
    if (siteHandler.clearResponseCache) {
      siteHandler.clearResponseCache();
    }
    
    // Debug page structure
    siteHandler.debugPageStructure();
    
    // Wait for page to be fully loaded
    await waitForElement('textarea, input[type="text"]', 10000);
    
    // Find the input field using site-specific handler
    const input = await siteHandler.findInputField();
    
    if (!input) {
      throw new Error(`Could not find input field on ${siteHandler.siteName}`);
    }
    
    // Clear and set new prompt
    if (input.getAttribute('contenteditable') === 'true') {
      // Handle contenteditable elements
      input.textContent = prompt;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      // Also trigger composition events for better compatibility
      input.dispatchEvent(new CompositionEvent('compositionend', { data: prompt, bubbles: true }));
    } else {
      // Handle regular input/textarea elements
      input.value = prompt;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Wait a moment for the input to be processed
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Find and click submit button using site-specific handler
    const submitButton = await siteHandler.findSubmitButton();
    
    if (!submitButton) {
      // Try alternative submission methods using site-specific handler
      console.log(`Submit button not found on ${siteHandler.siteName}, trying alternative methods...`);
      const success = await siteHandler.tryAlternativeSubmission(input, prompt);
      if (!success) {
        throw new Error(`Could not find submit button or alternative submission method on ${siteHandler.siteName}`);
      }
    } else {
      console.log(`Clicking submit button on ${siteHandler.siteName}`);
      submitButton.click();
    }
    
    // Wait for response to complete
    await waitForResponse(prompt);
    
  } catch (error) {
    console.error(`Error submitting prompt to ${siteHandler.siteName}:`, error);
    chrome.runtime.sendMessage({
      type: "error",
      error: error.message
    });
  } finally {
    isProcessing = false;
  }
}

async function waitForResponse(prompt) {
  return new Promise((resolve, reject) => {
    let responseObserver = null;
    let stabilityCheck = null;
    let lastResponseText = '';
    let stableCount = 0;
    let isResolved = false; // Flag to prevent multiple resolutions
    const requiredStableChecks = 3; // Number of consecutive stable checks needed
    const stabilityInterval = 2000; // Check every 2 seconds
    
    const cleanup = () => {
      if (responseObserver) {
        responseObserver.disconnect();
        responseObserver = null;
      }
      if (stabilityCheck) {
        clearTimeout(stabilityCheck);
        stabilityCheck = null;
      }
    };
    
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Response timeout'));
    }, 300000); // 5 minute timeout for longer responses
    
    // Add a fallback timeout for capturing response even if not perfectly stable
    const fallbackTimeout = setTimeout(async () => {
      if (isResolved) {
        return; // Don't handle if already resolved
      }
      const currentResponse = await siteHandler.extractLatestResponse();
      if (currentResponse && currentResponse.trim().length > 0) {
        console.log('Fallback timeout reached, capturing response even if not perfectly stable');
        handleResponse(currentResponse, 'fallback timeout');
      }
    }, 60000); // 1 minute fallback timeout
    
    console.log(`Starting to wait for ${siteHandler.siteName} response...`);
    
    const handleResponse = (response, source) => {
      if (isResolved) {
        console.log(`${siteHandler.siteName} response already handled, skipping duplicate`);
        return;
      }
      
      isResolved = true;
      clearTimeout(timeout);
      clearTimeout(fallbackTimeout); // Clear fallback timeout on successful response
      cleanup();
      
      console.log(`${siteHandler.siteName} response received via ${source}, length:`, response.length);
      // extract the markdown from the response
      siteHandler.extractMarkdownViaCopyButton(response).then(markdown => {
        // Send response back to background script
        chrome.runtime.sendMessage({
          type: "saveResponse",
          prompt: prompt,
          response: (markdown || response).trim(),
          site: siteHandler.siteName
        });
      });
      
      resolve();
    };
    
    // Function to check if response is stable (no longer changing)
    const checkResponseStability = async () => {
      if (isResolved) {
        return; // Don't check if already resolved
      }
      
      const currentResponse = await siteHandler.extractLatestResponse();
      
      if (currentResponse && currentResponse.trim().length > 0) {
        const currentText = currentResponse.trim();
        
        if (currentText === lastResponseText) {
          stableCount++;
          console.log(`${siteHandler.siteName} response stable for ${stableCount}/${requiredStableChecks} checks`);
          
          if (stableCount >= requiredStableChecks) {
            console.log(`${siteHandler.siteName} response is stable, capturing final response`);
            handleResponse(currentResponse, 'stability check');
            return;
          }
        } else {
          // Response changed, but check if it's a small change (like punctuation or formatting)
          const changeRatio = Math.abs(currentText.length - lastResponseText.length) / Math.max(currentText.length, lastResponseText.length);
          
          if (changeRatio < 0.05 && currentText.length > lastResponseText.length) {
            // Small change, likely just finishing touches - count as stable
            stableCount++;
            console.log(`Small change detected on ${siteHandler.siteName} (${changeRatio.toFixed(3)}), counting as stable: ${stableCount}/${requiredStableChecks}`);
            
            if (stableCount >= requiredStableChecks) {
              console.log(`${siteHandler.siteName} response is stable after small changes, capturing final response`);
              handleResponse(currentResponse, 'stability check');
              return;
            }
          } else {
            // Significant change, reset stability counter
            stableCount = 0;
            console.log(`Significant change detected on ${siteHandler.siteName} (${changeRatio.toFixed(3)}), resetting stability counter. New length: ${currentText.length}`);
          }
          
          lastResponseText = currentText;
        }
      }
    };
    
    // Start observing for response
    responseObserver = new MutationObserver(async (mutations) => {
      // Check for response changes
      const currentResponse = await siteHandler.extractLatestResponse();
      if (currentResponse && currentResponse.trim().length > 0) {
        const currentText = currentResponse.trim();
        
        if (currentText !== lastResponseText) {
          stableCount = 0; // Reset stability counter when response changes
          lastResponseText = currentText;
          console.log(`${siteHandler.siteName} response updated via mutation observer. New length:`, currentText.length);
        }
      }
    });
    
    // Observe the chat container using site-specific handler
    const chatContainer = siteHandler.findChatContainer();
    if (chatContainer) {
      console.log(`Observing ${siteHandler.siteName} chat container for responses`);
      responseObserver.observe(chatContainer, {
        childList: true,
        subtree: true,
        characterData: true
      });
      
      // Start stability checking after a short delay
      setTimeout(() => {
        const runStabilityCheck = async () => {
          if (isResolved) {
            return; // Don't schedule next check if already resolved
          }
          await checkResponseStability();
          if (!isResolved) {
            stabilityCheck = setTimeout(runStabilityCheck, stabilityInterval);
          }
        };
        runStabilityCheck();
      }, 3000); // Wait 3 seconds before starting stability checks
      
    } else {
      cleanup();
      reject(new Error(`Could not find ${siteHandler.siteName} chat container`));
    }
  });
}

async function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (responseObserver) {
    responseObserver.disconnect();
  }
});