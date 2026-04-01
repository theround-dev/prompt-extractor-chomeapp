let isProcessing = false;
let responseObserver = null;
let siteHandler = null;
let stopProcessing = false;
let automationConfig = {
  delayExecutionEnabled: false,
  delayProfile: 'balanced'
};
let lastThrottleSignalAt = 0;

// Configuration
const CONFIG = {
  createFreshWindow: true,
  freshWindowTimeout: 5000,
  enableFollowUpQuestions: false,
  debug: true // Toggle debug logging
};

// Utility functions
const log = (message, ...args) => {
  if (CONFIG.debug) console.log(message, ...args);
};

const logError = (message, ...args) => {
  console.error(message, ...args);
};

// Response validation helpers
async function extractResponseFromPage() {
  const response = await siteHandler.extractLatestResponse();
  const markdown = await siteHandler.extractMarkdownViaCopyButton();
  return (markdown || response || '').trim();
}

function responseMatchesPrompt(response, promptText) {
  if (!response || !promptText) return true; // Treat empty as invalid
  const r = response.trim().replace(/\s+/g, ' ');
  const p = promptText.trim().replace(/\s+/g, ' ');
  return r === p;
}

// Site detection and initialization
function detectSiteAndInitialize() {
  const hostname = window.location.hostname;
  log('Detected hostname:', hostname);
  
  if (hostname.includes('deepseek.com')) {
    siteHandler = new DeepSeekHandler();
  } else if (hostname.includes('chatgpt.com')) {
    siteHandler = new OpenAIHandler();
  } else {
    logError('Unsupported site:', hostname);
    return false;
  }
  
  log(`Initialized ${siteHandler.siteName} handler`);
  return true;
}

// Initialize and notify background script
if (!detectSiteAndInitialize()) {
  logError('Failed to initialize site handler');
}
chrome.runtime.sendMessage({ type: "ready" });

// Message listener
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  log('Content script received:', request.type);
  
  switch (request.type) {
    case "nextPrompt":
      automationConfig = {
        delayExecutionEnabled: Boolean(request.automationConfig?.delayExecutionEnabled),
        delayProfile: request.automationConfig?.delayProfile || 'balanced'
      };
      if (!isProcessing && !stopProcessing) {
        await submitPrompt(request.prompt);
      } else {
        log('Still processing previous prompt or stopped, skipping...');
      }
      break;
    case "stopProcessing":
      stopProcessing = true;
      isProcessing = false;
      if (responseObserver) {
        responseObserver.disconnect();
        responseObserver = null;
      }
      break;
    case "ready":
      sendResponse({ status: "ready" });
      break;
  }
});

// Core prompt submission function
async function submitPrompt(prompt) {
  try {
    isProcessing = true;
    stopProcessing = false;
    
    if (stopProcessing) return;
    
    const promptText = prompt.text || prompt;
    log(`Submitting prompt to ${siteHandler.siteName}:`, promptText);
    await performHumanLikeDelayTactics();
    if (stopProcessing) return;
    detectAndReportThrottleModal();

    // Create fresh window if enabled
    if (CONFIG.createFreshWindow) {
      await createFreshPromptWindow();
      if (stopProcessing) return;
      
      await waitForPageReady();
      if (stopProcessing) return;
      
      await verifyFreshInput();
      if (stopProcessing) return;
    }
    
    // Clear cache and find input
    if (siteHandler.clearResponseCache) {
      siteHandler.clearResponseCache();
    }
    
    await waitForElement('textarea, input[type="text"]', 15000);
    if (stopProcessing) return;
    
    const input = await siteHandler.findInputField();
    if (!input) {
      throw new Error(`Could not find input field on ${siteHandler.siteName}`);
    }

    // Set prompt text
    await setPromptText(input, promptText);
    if (stopProcessing) return;
    
    // Submit prompt
    await submitPromptToSite(input, promptText);
    if (stopProcessing) return;
    
    // Wait for response
    let finalResponse = await waitForResponse(prompt, promptText);
    if (stopProcessing) return;

    // Validation: ensure response is not the same as prompt (retry up to 3 times)
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (stopProcessing) return;
      if (!responseMatchesPrompt(finalResponse, promptText)) {
        break; // Valid response
      }
      log(`Response matches prompt (attempt ${attempt}/${maxAttempts}), retrying extraction...`);
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2500)); // Wait for page to finish rendering
        try {
          finalResponse = await extractResponseFromPage();
        } catch (err) {
          logError('Error during retry extraction:', err);
        }
      }
    }

    if (stopProcessing) return;

    // If still invalid after retries, skip save and advance to next prompt
    if (responseMatchesPrompt(finalResponse, promptText)) {
      logError(`Response matches prompt after ${maxAttempts} attempts, skipping save`);
      chrome.runtime.sendMessage({
        type: "skipPrompt",
        prompt,
        reason: "response_matches_prompt"
      });
      return;
    }

    // Handle follow-up question if enabled
    let metadataResponse = null;
    if (CONFIG.enableFollowUpQuestions) {
      try {
        metadataResponse = await handleFollowUpQuestion(prompt, finalResponse);
      } catch (error) {
        logError('Error in follow-up question process:', error);
      }
    }

    if (stopProcessing) return;

    // Send response back
    const messageData = {
      type: "saveResponse",
      prompt: prompt.text || prompt,
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
      metadata: metadataResponse
    };

    chrome.runtime.sendMessage(messageData);
    
  } catch (error) {
    logError(`Error submitting prompt to ${siteHandler.siteName}:`, error);
    chrome.runtime.sendMessage({
      type: "error",
      error: error.message
    });
  } finally {
    isProcessing = false;
  }
}

// Helper functions
async function waitForPageReady() {
  log('Waiting for page to be fully ready...');
  
  if (document.readyState !== 'complete') {
    await new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', resolve, { once: true });
      }
    });
  }
  
  // Additional delay for DOM rendering
  await new Promise(resolve => setTimeout(resolve, 3000));
}

async function verifyFreshInput() {
  log('Verifying fresh input field...');
  let attempts = 0;
  const maxAttempts = 5;
  
  while (attempts < maxAttempts && !stopProcessing) {
    const testInput = await siteHandler.findInputField();
    if (testInput) {
      const currentContent = testInput.textContent || testInput.value;
      if (!currentContent || currentContent.trim() === '') {
        log('Found fresh input field, proceeding...');
        break;
      } else {
        log('Input field still has content, waiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    } else {
      log('No input field found, waiting...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
  }
  
  if (attempts >= maxAttempts) {
    log('Warning: Could not verify fresh input field after multiple attempts');
  }
}

async function setPromptText(input, promptText) {
  log('Setting prompt text...');
  
  if (input.getAttribute('contenteditable') === 'true') {
    // Clear first
    input.textContent = '';
    input.innerHTML = '';
    
    // Set content
    input.textContent = promptText;
    
    // Fallback methods if needed
    if (input.textContent !== promptText) {
      input.innerHTML = promptText;
    }
    
    if (input.textContent !== promptText && input.innerHTML !== promptText) {
      input.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, promptText);
    }
    
    // Dispatch events
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new CompositionEvent('compositionend', { data: promptText, bubbles: true }));
  } else {
    input.value = promptText;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Verify input still exists and has correct content
  if (!document.contains(input)) {
    const newInput = await siteHandler.findInputField();
    if (newInput) {
      await setPromptText(newInput, promptText);
    }
  }
}

async function submitPromptToSite(input, promptText) {
  const submitButton = await siteHandler.findSubmitButton();
  
  if (!submitButton) {
    const success = await siteHandler.tryAlternativeSubmission(input, promptText);
    if (!success) {
      throw new Error(`Could not find submit button or alternative submission method on ${siteHandler.siteName}`);
    }
  } else {
    log(`Clicking submit button on ${siteHandler.siteName}`);
    submitButton.click();
  }
}

async function waitForResponse(prompt, promptText, options = {}) {
  const defaultOptions = {
    isFollowUp: false,
    timeout: 300000,
    requiredStableChecks: 3,
    stabilityInterval: 2000,
    fallbackTimeout: 60000,
    startStabilityCheckDelay: 5000
  };
  
  if (options.isFollowUp) {
    defaultOptions.timeout = 240000;
    defaultOptions.requiredStableChecks = 2;
    defaultOptions.stabilityInterval = 1500;
    defaultOptions.fallbackTimeout = 120000;
    defaultOptions.startStabilityCheckDelay = 5000;
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
    
    const fallbackTimeout = setTimeout(async () => {
      if (isResolved) return;
      const currentResponse = await siteHandler.extractLatestResponse();
      if (currentResponse && currentResponse.trim().length > 0) {
        log(`Fallback timeout reached for ${responseType} response, capturing response`);
        handleResponse(currentResponse, 'fallback timeout');
      }
    }, config.fallbackTimeout);
    
    log(`Starting to wait for ${siteHandler.siteName} ${responseType} response...`);
    
    const handleResponse = async (response, source) => {
      if (isResolved) return;
      
      isResolved = true;
      clearTimeout(timeout);
      clearTimeout(fallbackTimeout);
      cleanup();
      
      log(`${siteHandler.siteName} ${responseType} response received via ${source}, length:`, response.length);
      
      // Try to get markdown content using copy button, fallback to normal text
      const markdown = await siteHandler.extractMarkdownViaCopyButton();
      const finalResponse = (markdown || response).trim();
      
      resolve(finalResponse);
    };
    
    const checkResponseStability = async () => {
      if (isResolved || stopProcessing) return;
      detectAndReportThrottleModal();
      
      const currentResponse = await siteHandler.extractLatestResponse();
      
      if (currentResponse && currentResponse.trim().length > 0) {
        const currentText = currentResponse.trim();
        
        if (currentText === lastResponseText) {
          stableCount++;
          log(`${siteHandler.siteName} ${responseType} response stable for ${stableCount}/${config.requiredStableChecks} checks`);
          
          if (stableCount >= config.requiredStableChecks) {
            log(`${siteHandler.siteName} ${responseType} response is stable, checking for copy button...`);
            
            let copyButtonExists = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
              const markdownCheck = await siteHandler.extractMarkdownViaCopyButton();
              if (markdownCheck) {
                copyButtonExists = true;
                break;
              }
              if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
            
            if (copyButtonExists) {
              log(`${siteHandler.siteName} ${responseType} response is stable and copy button exists, capturing final response`);
              handleResponse(currentResponse, 'stability check');
            } else {
              log(`${siteHandler.siteName} ${responseType} response is stable but no copy button found, continuing to wait...`);
              stableCount = 0;
            }
            return;
          }
        } else {
          const changeRatio = Math.abs(currentText.length - lastResponseText.length) / Math.max(currentText.length, lastResponseText.length);
          
          if (changeRatio < 0.05 && currentText.length > lastResponseText.length) {
            stableCount++;
            log(`Small change detected on ${siteHandler.siteName} ${responseType} (${changeRatio.toFixed(3)}), counting as stable: ${stableCount}/${config.requiredStableChecks}`);
            
            if (stableCount >= config.requiredStableChecks) {
              log(`${siteHandler.siteName} ${responseType} response is stable after small changes, checking for copy button...`);
              
              let copyButtonExists = false;
              for (let attempt = 1; attempt <= 3; attempt++) {
                const markdownCheck = await siteHandler.extractMarkdownViaCopyButton();
                if (markdownCheck) {
                  copyButtonExists = true;
                  break;
                }
                if (attempt < 3) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
              
              if (copyButtonExists) {
                log(`${siteHandler.siteName} ${responseType} response is stable after small changes and copy button exists, capturing final response`);
                handleResponse(currentResponse, 'stability check');
              } else {
                log(`${siteHandler.siteName} ${responseType} response is stable after small changes but no copy button found, continuing to wait...`);
                stableCount = 0;
              }
              return;
            }
          } else {
            stableCount = 0;
            log(`Significant change detected on ${siteHandler.siteName} ${responseType} (${changeRatio.toFixed(3)}), resetting stability counter. New length: ${currentText.length}`);
          }
          
          lastResponseText = currentText;
        }
      }
    };
    
    responseObserver = new MutationObserver(async (mutations) => {
      if (stopProcessing) {
        cleanup();
        reject(new Error('Processing stopped by user'));
        return;
      }
      
      const currentResponse = await siteHandler.extractLatestResponse();
      if (currentResponse && currentResponse.trim().length > 0) {
        const currentText = currentResponse.trim();
        
        if (currentText !== lastResponseText) {
          stableCount = 0;
          lastResponseText = currentText;
        }
      }
    });
    
    const chatContainer = siteHandler.findChatContainer();
    if (chatContainer) {
      log(`Observing ${siteHandler.siteName} chat container for ${responseType} responses`);
      responseObserver.observe(chatContainer, {
        childList: true,
        subtree: true,
        characterData: true
      });
      
      setTimeout(() => {
        const runStabilityCheck = async () => {
          if (isResolved || stopProcessing) return;
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

async function handleFollowUpQuestion(originalPrompt, originalResponse) {
  try {
    log('=== Starting Follow-up Question for Metadata ===');
    
    if (stopProcessing) return null;
    
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

    log('Submitting follow-up question for metadata...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    if (stopProcessing) return null;
    
    const input = await siteHandler.findInputField();
    if (!input) {
      logError('Could not find input field for follow-up question');
      return;
    }
    
    await setPromptText(input, followUpPrompt);
    
    if (stopProcessing) return null;
    
    const submitButton = await siteHandler.findSubmitButton();
    if (!submitButton) {
      logError('Could not find submit button for follow-up question');
      return;
    }
    
    log('Submitting follow-up question...');
    submitButton.click();
    
    const metadataResponse = await waitForResponse(originalPrompt, originalResponse, { isFollowUp: true });
    
    if (metadataResponse) {
      log('Follow-up response received, returning metadata...');
      return metadataResponse.trim();
    }
    
    return null;
    
  } catch (error) {
    logError('Error handling follow-up question:', error);
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
  log(`Creating fresh prompt window for ${siteHandler.siteName}...`);
  
  const currentUrl = window.location.href;
  siteHandler.createNewPromptWindow();
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      log(`Fresh window creation timeout for ${siteHandler.siteName}, continuing anyway...`);
      resolve();
    }, CONFIG.freshWindowTimeout);
    
    const checkNavigation = () => {
      if (window.location.href !== currentUrl) {
        log(`Navigation completed for ${siteHandler.siteName}`);
        clearTimeout(timeout);
        resolve();
        return;
      }
      
      if (document.readyState === 'complete') {
        log(`Page reload completed for ${siteHandler.siteName}`);
        clearTimeout(timeout);
        resolve();
        return;
      }
      
      setTimeout(() => {
        log(`Fresh window creation completed for ${siteHandler.siteName} (non-refresh approach)`);
        clearTimeout(timeout);
        resolve();
      }, CONFIG.freshWindowTimeout);
    };
    
    checkNavigation();
  });
}

function getProfileRanges() {
  if (automationConfig.delayProfile === 'conservative') {
    return { idleMin: 600, idleMax: 2200, hesitationMin: 400, hesitationMax: 1400 };
  }
  if (automationConfig.delayProfile === 'aggressive_humanlike') {
    return { idleMin: 1800, idleMax: 6500, hesitationMin: 1200, hesitationMax: 3500 };
  }
  return { idleMin: 1200, idleMax: 4000, hesitationMin: 800, hesitationMax: 2200 };
}

function randomMs(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function performHumanLikeDelayTactics() {
  if (!automationConfig.delayExecutionEnabled || stopProcessing) return;

  const ranges = getProfileRanges();
  await new Promise(resolve => setTimeout(resolve, randomMs(ranges.idleMin, ranges.idleMax)));
  if (stopProcessing) return;

  const scrollTarget = siteHandler.getSafeScrollElement ? siteHandler.getSafeScrollElement() : document.scrollingElement;
  if (scrollTarget && typeof scrollTarget.scrollBy === 'function' && Math.random() < 0.75) {
    scrollTarget.scrollBy({ top: randomMs(40, 220), behavior: 'smooth' });
    await new Promise(resolve => setTimeout(resolve, randomMs(250, 900)));
    if (stopProcessing) return;
    scrollTarget.scrollBy({ top: -randomMs(20, 140), behavior: 'smooth' });
  }

  if (Math.random() < 0.6) {
    const input = await siteHandler.findInputField();
    if (input) {
      input.focus();
      await new Promise(resolve => setTimeout(resolve, randomMs(100, 500)));
      input.blur();
      await new Promise(resolve => setTimeout(resolve, randomMs(100, 500)));
      input.focus();
    }
  }

  await new Promise(resolve => setTimeout(resolve, randomMs(ranges.hesitationMin, ranges.hesitationMax)));
}

function detectAndReportThrottleModal() {
  const now = Date.now();
  if (now - lastThrottleSignalAt < 10000) {
    return false;
  }
  const pageText = (document.body?.innerText || '').toLowerCase();
  const isThrottle = pageText.includes('too many requests')
    || pageText.includes('temporarily limited')
    || pageText.includes('wait a few minutes');

  if (isThrottle) {
    lastThrottleSignalAt = now;
    chrome.runtime.sendMessage({
      type: 'throttleDetected',
      site: siteHandler?.siteName || 'Unknown',
      detectedAt: new Date().toISOString()
    });
  }
  return isThrottle;
}

// Event listeners
window.addEventListener('beforeunload', () => {
  if (responseObserver) {
    responseObserver.disconnect();
  }
});

// Manual testing function
async function testPromptSetting(prompt = "test prompt") {
  log('=== Manual Prompt Setting Test ===');
  const input = await siteHandler.findInputField();
  
  if (!input) {
    logError('No input field found for testing');
    return false;
  }
  
  log('Testing with input:', {
    tagName: input.tagName,
    contenteditable: input.getAttribute('contenteditable'),
    classes: input.className,
    currentContent: input.textContent || input.value
  });
  
  await setPromptText(input, prompt);
  
  const finalContent = input.textContent || input.value;
  log('Final content:', finalContent);
  log('Success:', finalContent === prompt);
  
  return finalContent === prompt;
}

// Make functions available globally
window.testPromptSetting = testPromptSetting;