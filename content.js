let isProcessing = false;
let responseObserver = null;
let siteHandler = null;
let stopProcessing = false; // Flag to track if processing should be stopped

// Configuration options
const CONFIG = {
  createFreshWindow: true, // Set to false to disable fresh window creation
  freshWindowTimeout: 5000, // Timeout for fresh window creation in ms (increased for better reliability)
  enableFollowUpQuestions: true // Set to false to disable follow-up questions for metadata
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
    console.log('Content script received nextPrompt:', request.prompt);
    console.log('Prompt brand_id:', request.prompt.brand_id);
    console.log('Prompt id:', request.prompt.id);
    console.log('Full prompt object:', JSON.stringify(request.prompt, null, 2));
    if (!isProcessing && !stopProcessing) {
      await submitPrompt(request.prompt);
    } else {
      console.log('Still processing previous prompt or stopped, skipping...');
    }
  } else if (request.type === "stopProcessing") {
    console.log('Received stop processing message');
    stopProcessing = true;
    isProcessing = false;
    // Clean up any ongoing observers
    if (responseObserver) {
      responseObserver.disconnect();
      responseObserver = null;
    }
  } else if (request.type === "ready") {
    sendResponse({ status: "ready" });
  }
});

async function submitPrompt(prompt) {
  try {
    isProcessing = true;
    stopProcessing = false; // Reset stop flag when starting new prompt
    
    // Check if we should stop before starting
    if (stopProcessing) {
      console.log('Stop requested before starting prompt processing');
      return;
    }
    
    // Extract the prompt text from the prompt object or use as-is if it's already a string
    const promptText = prompt.text || prompt;
    console.log(`Submitting prompt to ${siteHandler.siteName}:`, promptText);

    // Create a new prompt fresh window and wait for navigation to complete
    if (CONFIG.createFreshWindow) {
      await createFreshPromptWindow();
      
      // Check if we should stop after fresh window creation
      if (stopProcessing) {
        console.log('Stop requested after fresh window creation');
        return;
      }
      
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
      
      // Check if we should stop after page load
      if (stopProcessing) {
        console.log('Stop requested after page load');
        return;
      }
      
      // Additional delay to ensure DOM is fully rendered and any dynamic content is loaded
      console.log('Waiting additional 3 seconds for DOM to be fully rendered...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if we should stop after DOM rendering delay
      if (stopProcessing) {
        console.log('Stop requested after DOM rendering delay');
        return;
      }
      
      // Double-check that we're on a fresh page by verifying the input field is empty
      console.log('Verifying we have a fresh input field...');
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts && !stopProcessing) {
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
      
      if (stopProcessing) {
        console.log('Stop requested during input field verification');
        return;
      }
      
      if (attempts >= maxAttempts) {
        console.log('Warning: Could not verify fresh input field after multiple attempts');
      }
    }
    
    // Check if we should stop before clearing response cache
    if (stopProcessing) {
      console.log('Stop requested before clearing response cache');
      return;
    }
    
    // Clear response cache for new prompt
    if (siteHandler.clearResponseCache) {
      siteHandler.clearResponseCache();
    }
    
    // Debug page structure
    siteHandler.debugPageStructure();
    
    // Wait for page to be fully loaded with longer timeout
    await waitForElement('textarea, input[type="text"]', 15000);
    
    // Check if we should stop after waiting for elements
    if (stopProcessing) {
      console.log('Stop requested after waiting for elements');
      return;
    }
    
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
      console.log('Setting contenteditable input with prompt:', promptText);
      
      // Method 1: Clear first
      input.textContent = '';
      input.innerHTML = '';
      
      // Method 2: Try different setting approaches
      input.textContent = promptText;
      console.log('After setting textContent:', input.textContent);
      
      // Method 3: Also try innerHTML for contenteditable
      if (input.textContent !== promptText) {
        console.log('textContent failed, trying innerHTML...');
        input.innerHTML = promptText;
        console.log('After setting innerHTML:', input.innerHTML);
      }
      
      // Method 4: Focus the element first and try again
      input.focus();
      input.textContent = promptText;
      console.log('After focus + textContent:', input.textContent);
      
      // Method 5: Try using execCommand for contenteditable
      if (input.textContent !== promptText) {
        console.log('textContent still failed, trying execCommand...');
        input.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, promptText);
        console.log('After execCommand:', input.textContent);
      }
      
      console.log('After setting, textContent:', input.textContent, 'innerHTML:', input.innerHTML);
      
      // Dispatch events
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new CompositionEvent('compositionend', { data: prompt, bubbles: true }));
      
      console.log('After events, textContent:', input.textContent);
    } else {
      console.log('Setting regular input with prompt:', promptText);
      input.value = promptText;
      console.log('After setting value:', input.value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('After dispatching events, value:', input.value);
    }
    
    // Wait a moment for the input to be processed
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if we should stop after setting the prompt
    if (stopProcessing) {
      console.log('Stop requested after setting prompt');
      return;
    }
    
    // Verify the input still exists and has the correct content
    const inputStillExists = document.contains(input);
    const currentContent = input.textContent || input.value;
    console.log('Input verification after 500ms:', {
      stillExists: inputStillExists,
      currentContent: currentContent,
      expectedContent: promptText,
      matches: currentContent === promptText
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
      const success = await siteHandler.tryAlternativeSubmission(input, promptText);
      if (!success) {
        throw new Error(`Could not find submit button or alternative submission method on ${siteHandler.siteName}`);
      }
    } else {
      console.log(`Clicking submit button on ${siteHandler.siteName}`);
      submitButton.click();
    }
    
    // Check if we should stop before waiting for response
    if (stopProcessing) {
      console.log('Stop requested before waiting for response');
      return;
    }
    
    // Wait for response to complete
    const finalResponse = await waitForResponse(prompt, promptText);
    
    // Check if we should stop after getting the main response
    if (stopProcessing) {
      console.log('Stop requested after getting main response');
      return;
    }
    
    // Handle follow-up question for metadata if enabled
    let metadataResponse = null;
    if (CONFIG.enableFollowUpQuestions) {
      try {
        metadataResponse = await handleFollowUpQuestion(prompt, finalResponse);
      } catch (error) {
        console.error('Error in follow-up question process:', error);
        // Continue without metadata if follow-up fails
        metadataResponse = null;
      }
    }
    
    // Check if we should stop before sending response back
    if (stopProcessing) {
      console.log('Stop requested before sending response back');
      return;
    }
    
    // Send the main response back to background script with metadata
    const messageData = {
      type: "saveResponse",
      prompt: prompt.text || prompt, // Handle both prompt object and string
      response: finalResponse,
      site: siteHandler.siteName,
      promptId: prompt.id,
      category: prompt.category,
      tags: prompt.tags,
      measurements: prompt.measurements,
      brandId: prompt.brand_id,
      brandName: prompt.brand?.name,
      brandDescription: prompt.brand?.description,
      approved: prompt.approved,
      active: prompt.active,
      createdAt: prompt.created_at,
      metadata: metadataResponse // Add metadata if available
    };
    
    console.log('Content script sending saveResponse message:', messageData);
    console.log('Message brandId:', messageData.brandId);
    chrome.runtime.sendMessage(messageData);
    
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

async function waitForResponse(prompt, promptText, options = {}) {
  // Default options for main responses
  const defaultOptions = {
    isFollowUp: false,
    timeout: 300000, // 5 minutes for main responses
    requiredStableChecks: 3,
    stabilityInterval: 2000,
    fallbackTimeout: 60000, // 1 minute fallback
    startStabilityCheckDelay: 3000
  };
  
  // Override defaults for follow-up responses
  if (options.isFollowUp) {
    defaultOptions.timeout = 240000; // 4 minutes for follow-up (increased from 3)
    defaultOptions.requiredStableChecks = 2;
    defaultOptions.stabilityInterval = 1500;
    defaultOptions.fallbackTimeout = 120000; // 2 minutes fallback (increased from 1.5)
    defaultOptions.startStabilityCheckDelay = 2000;
  }
  
  const config = { ...defaultOptions, ...options };
  const responseType = config.isFollowUp ? 'follow-up' : 'main';
  
  return new Promise((resolve, reject) => {
    let responseObserver = null;
    let stabilityCheck = null;
    let lastResponseText = '';
    let stableCount = 0;
    let isResolved = false;
    
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
      reject(new Error(`${responseType} response timeout`));
    }, config.timeout);
    
    // Add a fallback timeout for capturing response even if not perfectly stable
    const fallbackTimeout = setTimeout(async () => {
      if (isResolved) {
        return; // Don't handle if already resolved
      }
      const currentResponse = await siteHandler.extractLatestResponse();
      if (currentResponse && currentResponse.trim().length > 0) {
        console.log(`Fallback timeout reached for ${responseType} response, capturing response even if not perfectly stable`);
        handleResponse(currentResponse, 'fallback timeout');
      }
    }, config.fallbackTimeout);
    
    console.log(`Starting to wait for ${siteHandler.siteName} ${responseType} response...`);
    
    const handleResponse = async (response, source) => {
      if (isResolved) {
        console.log(`${siteHandler.siteName} ${responseType} response already handled, skipping duplicate`);
        return;
      }
      
      isResolved = true;
      clearTimeout(timeout);
      clearTimeout(fallbackTimeout);
      cleanup();
      
      console.log(`${siteHandler.siteName} ${responseType} response received via ${source}, length:`, response.length);
      
      // Extract markdown from the response
      const markdown = await siteHandler.extractMarkdownViaCopyButton(response);
      const finalResponse = (markdown || response).trim();
      
      resolve(finalResponse);
    };
    
    // Function to check if response is stable (no longer changing)
    const checkResponseStability = async () => {
      if (isResolved || stopProcessing) {
        return; // Don't check if already resolved or stopped
      }
      
      const currentResponse = await siteHandler.extractLatestResponse();
      
      if (currentResponse && currentResponse.trim().length > 0) {
        const currentText = currentResponse.trim();
        
        if (currentText === lastResponseText) {
          stableCount++;
          console.log(`${siteHandler.siteName} ${responseType} response stable for ${stableCount}/${config.requiredStableChecks} checks`);
          
          if (stableCount >= config.requiredStableChecks) {
            console.log(`${siteHandler.siteName} ${responseType} response is stable, checking for copy button...`);
            
            // Check for copy button existence before proceeding with handleResponse
            let copyButtonExists = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
              console.log(`Copy button check attempt ${attempt}/3 for ${siteHandler.siteName} ${responseType} response`);
              
              // Try to extract markdown via copy button to check if it exists
              const markdownCheck = await siteHandler.extractMarkdownViaCopyButton(currentResponse);
              if (markdownCheck) {
                copyButtonExists = true;
                // console.log(`Copy button found on attempt ${attempt} for ${siteHandler.siteName} ${responseType} response`);
                break;
              }
              
              // Wait a bit before next attempt
              if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
            
            if (copyButtonExists) {
              console.log(`${siteHandler.siteName} ${responseType} response is stable and copy button exists, capturing final response`);
              handleResponse(currentResponse, 'stability check');
            } else {
              console.log(`${siteHandler.siteName} ${responseType} response is stable but no copy button found after 3 attempts, continuing to wait...`);
              // Reset stability counter to continue waiting for copy button
              stableCount = 0;
            }
            return;
          }
        } else {
          // Response changed, but check if it's a small change (like punctuation or formatting)
          const changeRatio = Math.abs(currentText.length - lastResponseText.length) / Math.max(currentText.length, lastResponseText.length);
          
          if (changeRatio < 0.05 && currentText.length > lastResponseText.length) {
            // Small change, likely just finishing touches - count as stable
            stableCount++;
            console.log(`Small change detected on ${siteHandler.siteName} ${responseType} (${changeRatio.toFixed(3)}), counting as stable: ${stableCount}/${config.requiredStableChecks}`);
            
            if (stableCount >= config.requiredStableChecks) {
              console.log(`${siteHandler.siteName} ${responseType} response is stable after small changes, checking for copy button...`);
              
              // Check for copy button existence before proceeding with handleResponse
              let copyButtonExists = false;
              for (let attempt = 1; attempt <= 3; attempt++) {
                console.log(`Copy button check attempt ${attempt}/3 for ${siteHandler.siteName} ${responseType} response (small changes)`);
                
                // Try to extract markdown via copy button to check if it exists
                const markdownCheck = await siteHandler.extractMarkdownViaCopyButton(currentResponse);
                if (markdownCheck) {
                  copyButtonExists = true;
                  // console.log(`Copy button found on attempt ${attempt} for ${siteHandler.siteName} ${responseType} response (small changes)`);
                  break;
                }
                
                // Wait a bit before next attempt
                if (attempt < 3) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
              
              if (copyButtonExists) {
                console.log(`${siteHandler.siteName} ${responseType} response is stable after small changes and copy button exists, capturing final response`);
                handleResponse(currentResponse, 'stability check');
              } else {
                console.log(`${siteHandler.siteName} ${responseType} response is stable after small changes but no copy button found after 3 attempts, continuing to wait...`);
                // Reset stability counter to continue waiting for copy button
                stableCount = 0;
              }
              return;
            }
          } else {
            // Significant change, reset stability counter
            stableCount = 0;
            console.log(`Significant change detected on ${siteHandler.siteName} ${responseType} (${changeRatio.toFixed(3)}), resetting stability counter. New length: ${currentText.length}`);
          }
          
          lastResponseText = currentText;
        }
      }
    };
    
    // Start observing for response
    responseObserver = new MutationObserver(async (mutations) => {
      // Check if we should stop processing
      if (stopProcessing) {
        cleanup();
        reject(new Error('Processing stopped by user'));
        return;
      }
      
      // Check for response changes
      const currentResponse = await siteHandler.extractLatestResponse();
      if (currentResponse && currentResponse.trim().length > 0) {
        const currentText = currentResponse.trim();
        
        if (currentText !== lastResponseText) {
          stableCount = 0; // Reset stability counter when response changes
          lastResponseText = currentText;
          // console.log(`${siteHandler.siteName} ${responseType} response updated via mutation observer. New length:`, currentText.length);
        }
      }
    });
    
    // Observe the chat container using site-specific handler
    const chatContainer = siteHandler.findChatContainer();
    if (chatContainer) {
      console.log(`Observing ${siteHandler.siteName} chat container for ${responseType} responses`);
      responseObserver.observe(chatContainer, {
        childList: true,
        subtree: true,
        characterData: true
      });
      
      // Start stability checking after a short delay
      setTimeout(() => {
        const runStabilityCheck = async () => {
          if (isResolved || stopProcessing) {
            return; // Don't schedule next check if already resolved or stopped
          }
          await checkResponseStability();
          if (!isResolved && !stopProcessing) {
            stabilityCheck = setTimeout(runStabilityCheck, config.stabilityInterval);
          }
        };
        runStabilityCheck();
      }, config.startStabilityCheckDelay);
      
    } else {
      cleanup();
      reject(new Error(`Could not find ${siteHandler.siteName} chat container`));
    }
  });
}

/**
 * Handles the follow-up question to capture metadata about the previous response.
 * This function submits a structured question asking for analysis of the response
 * and returns the metadata response for inclusion in the main response object.
 */
async function handleFollowUpQuestion(originalPrompt, originalResponse) {
  try {
    console.log('=== Starting Follow-up Question for Metadata ===');
    console.log('Original prompt:', originalPrompt.text || originalPrompt);
    console.log('Original response length:', originalResponse.length);
    
    // Check if we should stop before starting follow-up
    if (stopProcessing) {
      console.log('Stop requested before starting follow-up question');
      return null;
    }
    
    // Create the follow-up question that captures metadata about the previous response
    const followUpPrompt = `Please analyze my previous response in this conversation and return the following structured metadata as JSON:

{
  "response_quality_assessment": "excellent|good|fair|poor",
  "response_completeness": "complete|partial|minimal", 
  "sentiment": "positive|negative|neutral|mixed",
  "response_tone": "professional|casual|formal|informal",
  "response_length": "short|medium|long",
  "contains_specific_examples_or_citations": "Yes|No",
  "contains_actionable_advice_or_recommendations": "Yes|No", 
  "contains_disclaimers_or_uncertainty_statements": "Yes|No",
  "response_structure": "structured|conversational|bullet-points|narrative",
  "provider":"openai|string",
  "tokens_used":"string",
  "model_used": "string",
  "platform": "ChatGPT|API|playground|other",
  "model_version_id": "string",
  "knowledge_cutoff_date": "string",
  "external_tools_or_web_sources_used": "Yes|No",
  "answer_based_on_internal_knowledge_only": "Yes|No",
  "memory_or_custom_instructions_used": "Yes|No",
  "system_instructions_or_context_influenced": "Yes|No"
}

Please ensure all values are exactly as specified in the options above. For string fields, provide the actual values where known, or "unknown" if not accessible.`;

    console.log('Submitting follow-up question for metadata...');
    
    // Wait a moment for the page to be ready for the next input
    await new Promise(resolve => setTimeout(resolve, 5000)); // Increased from 3 to 5 seconds
    
    // Check if we should stop after waiting
    if (stopProcessing) {
      console.log('Stop requested after waiting for page readiness');
      return null;
    }
    
    // Find the input field
    const input = await siteHandler.findInputField();
    
    if (!input) {
      console.error('Could not find input field for follow-up question');
      return;
    }
    
    // Set the follow-up question
    if (input.getAttribute('contenteditable') === 'true') {
      input.textContent = followUpPrompt;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      input.value = followUpPrompt;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Wait a moment for the input to be processed
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if we should stop after setting the follow-up question
    if (stopProcessing) {
      console.log('Stop requested after setting follow-up question');
      return null;
    }
    
    // Find and click submit button
    const submitButton = await siteHandler.findSubmitButton();
    
    if (!submitButton) {
      console.error('Could not find submit button for follow-up question');
      return;
    }
    
    console.log('Submitting follow-up question...');
    submitButton.click();
    
    // Wait for the follow-up response
    console.log('Starting to wait for follow-up response...');
    const metadataResponse = await waitForResponse(originalPrompt, originalResponse, { isFollowUp: true });
    
    if (metadataResponse) {
      console.log('Follow-up response received, returning metadata...');
      console.log('Metadata response length:', metadataResponse.length);
      return metadataResponse.trim();
    }
    
    return null; // Return null if no metadata response
    
  } catch (error) {
    console.error('Error handling follow-up question:', error);
  }
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