let isProcessing = false;
let responseObserver = null;
let siteHandler = null;

// Configuration options
const CONFIG = {
  createFreshWindow: true, // Set to false to disable fresh window creation
  freshWindowTimeout: 5000 // Timeout for fresh window creation in ms (increased for better reliability)
};

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

    // Create a new prompt fresh window and wait for navigation to complete
    if (CONFIG.createFreshWindow) {
      await createFreshPromptWindow();
      
      // Add additional delay and page readiness check after fresh window creation
      console.log('Waiting for page to be fully ready after fresh window creation...');
      
      // Wait for document to be ready
      if (document.readyState !== 'complete') {
        console.log('Document not ready, waiting for load event...');
        await new Promise(resolve => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            window.addEventListener('load', resolve, { once: true });
          }
        });
      }
      
      // Additional delay to ensure DOM is fully rendered and any dynamic content is loaded
      console.log('Waiting additional 3 seconds for DOM to be fully rendered...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Double-check that we're on a fresh page by verifying the input field is empty
      console.log('Verifying we have a fresh input field...');
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        const testInput = await siteHandler.findInputField();
        if (testInput) {
          const currentContent = testInput.textContent || testInput.value;
          console.log(`Attempt ${attempts + 1}: Found input field with content: "${currentContent}"`);
          
          if (!currentContent || currentContent.trim() === '') {
            console.log('Found fresh input field, proceeding...');
            break;
          } else {
            console.log('Input field still has content, waiting longer...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          }
        } else {
          console.log(`Attempt ${attempts + 1}: No input field found, waiting...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }
      
      if (attempts >= maxAttempts) {
        console.log('Warning: Could not verify fresh input field after multiple attempts');
      }
    }
    
    // Clear response cache for new prompt
    if (siteHandler.clearResponseCache) {
      siteHandler.clearResponseCache();
    }
    
    // Debug page structure
    siteHandler.debugPageStructure();
    
    // Wait for page to be fully loaded with longer timeout
    await waitForElement('textarea, input[type="text"]', 15000);
    
    // Find the input field using site-specific handler
    const input = await siteHandler.findInputField();
    
    if (!input) {
      throw new Error(`Could not find input field on ${siteHandler.siteName}`);
    }

    // Add debug logging here
    console.log('=== Setting Prompt ===');
    console.log('Input element:', {
      tagName: input.tagName,
      contenteditable: input.getAttribute('contenteditable'),
      classes: input.className,
      currentValue: input.textContent || input.value,
      isVisible: input.offsetParent !== null,
      rect: input.getBoundingClientRect()
    });
    
    // Clear and set new prompt
    if (input.getAttribute('contenteditable') === 'true') {
      console.log('Setting contenteditable input with prompt:', prompt);
      
      // Method 1: Clear first
      input.textContent = '';
      input.innerHTML = '';
      
      // Method 2: Try different setting approaches
      input.textContent = prompt;
      console.log('After setting textContent:', input.textContent);
      
      // Method 3: Also try innerHTML for contenteditable
      if (input.textContent !== prompt) {
        console.log('textContent failed, trying innerHTML...');
        input.innerHTML = prompt;
        console.log('After setting innerHTML:', input.innerHTML);
      }
      
      // Method 4: Focus the element first and try again
      input.focus();
      input.textContent = prompt;
      console.log('After focus + textContent:', input.textContent);
      
      // Method 5: Try using execCommand for contenteditable
      if (input.textContent !== prompt) {
        console.log('textContent still failed, trying execCommand...');
        input.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, prompt);
        console.log('After execCommand:', input.textContent);
      }
      
      console.log('After setting, textContent:', input.textContent, 'innerHTML:', input.innerHTML);
      
      // Dispatch events
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new CompositionEvent('compositionend', { data: prompt, bubbles: true }));
      
      console.log('After events, textContent:', input.textContent);
    } else {
      console.log('Setting regular input with prompt:', prompt);
      input.value = prompt;
      console.log('After setting value:', input.value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('After dispatching events, value:', input.value);
    }
    
    // Wait a moment for the input to be processed
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify the input still exists and has the correct content
    const inputStillExists = document.contains(input);
    const currentContent = input.textContent || input.value;
    console.log('Input verification after 500ms:', {
      stillExists: inputStillExists,
      currentContent: currentContent,
      expectedContent: prompt,
      matches: currentContent === prompt
    });

    if (!inputStillExists) {
      console.log('Input field was replaced, finding new one...');
      const newInput = await siteHandler.findInputField();
      if (newInput) {
        console.log('Found new input field, setting prompt again...');
        // Set prompt on the new input field
        if (newInput.getAttribute('contenteditable') === 'true') {
          newInput.textContent = prompt;
          newInput.dispatchEvent(new Event('input', { bubbles: true }));
          newInput.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          newInput.value = prompt;
          newInput.dispatchEvent(new Event('input', { bubbles: true }));
          newInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
    
    // Add verification after the wait
    console.log('After 500ms wait, input content:', input.textContent || input.value);
    
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

async function createFreshPromptWindow() {
    console.log("* * * * * * * * *")
  console.log(`Creating fresh prompt window for ${siteHandler.siteName}...`);
  
  // Store the current URL to detect navigation
  const currentUrl = window.location.href;
  
  // Call the site-specific method to create a new window
  siteHandler.createNewPromptWindow();
  
  // Wait for navigation to complete or timeout
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log(`Fresh window creation timeout for ${siteHandler.siteName}, continuing anyway...`);
      resolve();
    }, CONFIG.freshWindowTimeout);
    
    const checkNavigation = () => {
      // If the URL has changed, navigation is complete
      if (window.location.href !== currentUrl) {
        console.log(`Navigation completed for ${siteHandler.siteName}`);
        clearTimeout(timeout);
        resolve();
        return;
      }
      
      // If we're still on the same URL but it's a reload, check if page is ready
      if (document.readyState === 'complete') {
        console.log(`Page reload completed for ${siteHandler.siteName}`);
        clearTimeout(timeout);
        resolve();
        return;
      }
      
      // For non-refresh approaches, wait a bit then resolve
      setTimeout(() => {
        console.log(`Fresh window creation completed for ${siteHandler.siteName} (non-refresh approach)`);
        clearTimeout(timeout);
        resolve();
      }, CONFIG.freshWindowTimeout);
    };
    
    // Start checking for navigation completion
    checkNavigation();
  });
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (responseObserver) {
    responseObserver.disconnect();
  }
});

// Manual testing function - can be called from browser console
async function testPromptSetting(prompt = "test prompt") {
  console.log('=== Manual Prompt Setting Test ===');
  const input = await siteHandler.findInputField();
  
  if (!input) {
    console.error('No input field found for testing');
    return false;
  }
  
  console.log('Testing with input:', {
    tagName: input.tagName,
    contenteditable: input.getAttribute('contenteditable'),
    classes: input.className,
    currentContent: input.textContent || input.value
  });
  
  // Try setting the prompt
  if (input.getAttribute('contenteditable') === 'true') {
    console.log('Setting contenteditable input...');
    input.textContent = prompt;
    console.log('After textContent:', input.textContent);
    
    if (input.textContent !== prompt) {
      console.log('textContent failed, trying innerHTML...');
      input.innerHTML = prompt;
      console.log('After innerHTML:', input.innerHTML);
    }
    
    if (input.textContent !== prompt && input.innerHTML !== prompt) {
      console.log('Both failed, trying execCommand...');
      input.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, prompt);
      console.log('After execCommand:', input.textContent);
    }
  } else {
    console.log('Setting regular input...');
    input.value = prompt;
    console.log('After setting value:', input.value);
  }
  
  // Wait and check
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const finalContent = input.textContent || input.value;
  console.log('Final content:', finalContent);
  console.log('Success:', finalContent === prompt);
  
  return finalContent === prompt;
}

// Make the function available globally for console access
window.testPromptSetting = testPromptSetting;