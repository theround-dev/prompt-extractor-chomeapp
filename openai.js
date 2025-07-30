// OpenAI-specific implementation
class OpenAIHandler {
  constructor() {
    this.siteName = 'OpenAI';
  }

  createNewPromptWindow() {
    const newChatSelectors = [
      'a[data-testid="create-new-chat-button"]',
      'button[data-testid="create-new-chat-button"]',
      'button[data-testid="new-chat-button"]',
      'a[data-testid="new-chat-button"]',
      'button[aria-label*="New chat"]',
      'button[aria-label*="new chat"]',
      'button[title*="New chat"]',
      'button[title*="new chat"]',
      'button[class*="new-chat"]',
      'button[class*="New-chat"]',
      'a[href*="new"]',
      'button:contains("New")',
      'button:contains("Clear")',
      'button:contains("Reset")',
      '[data-testid="new-chat"]',
      '[data-testid="clear-chat"]',
      'button[aria-label="New chat"]',
      'button[aria-label="Start a new chat"]'
    ];
    
    for (const selector of newChatSelectors) {
      try {
        const button = document.querySelector(selector);
        if (button && button.offsetParent !== null && !button.disabled) {
          button.click();
          return;
        }
      } catch (error) {
        // Silently continue
      }
    }
    
    // Clear input field if no new chat button found
    const input = document.querySelector('textarea, input[type="text"], [contenteditable="true"]');
    if (input) {
      if (input.getAttribute('contenteditable') === 'true') {
        input.textContent = '';
      } else {
        input.value = '';
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Navigate to chat page if not already there
    const currentUrl = window.location.href;
    const baseUrl = 'https://chatgpt.com';
    
    if (!currentUrl.startsWith(baseUrl)) {
      window.location.href = baseUrl;
    }
  }

  async findInputField() {
    const selectors = [
      'textarea[name="prompt-textarea"]',
      'textarea[class*="fallbackTextarea"]',
      'form textarea',
      'form input[type="text"]'
    ];
    
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        
        for (const element of elements) {
          if (element && element.offsetParent !== null) {
            const rect = element.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            const isEditable = element.tagName === 'TEXTAREA' || 
                             element.tagName === 'INPUT' || 
                             element.getAttribute('contenteditable') === 'true';
            
            if (isVisible && isEditable) {
              return element;
            } else if (isEditable && element.style.display === 'none') {
              element.style.display = 'block';
              element.style.visibility = 'visible';
              element.style.opacity = '1';
              
              await new Promise(resolve => setTimeout(resolve, 100));
              
              const rect = element.getBoundingClientRect();
              const isNowVisible = rect.width > 0 && rect.height > 0;
              
              if (isNowVisible) {
                return element;
              }
            }
          }
        }
      } catch (error) {
        // Silently continue
      }
    }
    
    // Fallback to visible inputs
    const visibleInputs = document.querySelectorAll('[contenteditable="true"], textarea:not([style*="display: none"]), input[type="text"]:not([style*="display: none"])');
    
    for (const input of visibleInputs) {
      const rect = input.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 && input.offsetParent !== null;
      
      if (isVisible) {
        return input;
      }
    }
    
    return null;
  }

  async findSubmitButton() {
    const selectors = [
      'button[id="composer-submit-button"][data-testid="send-button"]',
      'button[id="composer-submit-button"]',
      'button[data-testid="send-button"]',
      'button[aria-label="Send prompt"]',
      'button[aria-label="Send message"]',
      'button[aria-label="Send"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="send"]',
      'button[title*="Send"]',
      'button[title*="send"]',
      'button[class*="composer-submit-btn"]',
      'button[class*="composer-submit-button"]',
      'button[class*="composer-submit"]',
      'button[class*="send"]',
      'button[class*="Send"]',
      'button[class*="submit"]',
      'button[class*="Submit"]',
      'button[type="submit"]',
      'button[aria-label*="Submit"]',
      'button[aria-label*="submit"]',
      'button[title*="Submit"]',
      'button[title*="submit"]',
      'button[data-testid="submit"]',
      '.send-button',
      '.submit-button',
      'textarea + button',
      'input + button',
      '[contenteditable="true"] + button'
    ];
    
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        
        for (const element of elements) {
          if (element && element.offsetParent !== null && !element.disabled) {
            const rect = element.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            const isNearInput = this.isNearInputField(element);
            
            const isExactMatch = (element.getAttribute('data-testid') === 'send-button' && element.id === 'composer-submit-button') || 
                               element.id === 'composer-submit-button' ||
                               element.getAttribute('data-testid') === 'send-button' ||
                               element.getAttribute('aria-label') === 'Send prompt';
            
            if (isVisible && (isExactMatch || isNearInput)) {
              return element;
            }
          }
        }
      } catch (error) {
        // Silently continue
      }
    }
    
    // Fallback to nearby button
    const input = await this.findInputField();
    if (input) {
      const nearbyButton = this.findNearbyButton(input);
      if (nearbyButton) {
        return nearbyButton;
      }
    }
    
    // Final fallbacks
    const specificButton = document.querySelector('button[id="composer-submit-button"][data-testid="send-button"]');
    if (specificButton && specificButton.offsetParent !== null && !specificButton.disabled) {
      return specificButton;
    }
    
    const exactButton = document.querySelector('button.composer-submit-btn.composer-submit-button-color');
    if (exactButton && exactButton.offsetParent !== null && !exactButton.disabled) {
      return exactButton;
    }
    
    const composerButton = document.querySelector('button[class*="composer-submit"]');
    if (composerButton && composerButton.offsetParent !== null && !composerButton.disabled) {
      return composerButton;
    }
    
    return null;
  }

  isNearInputField(button) {
    const input = document.querySelector('textarea, input[type="text"], [contenteditable="true"]');
    if (!input || !button) return false;
    
    const inputRect = input.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    
    const distance = Math.sqrt(
      Math.pow(buttonRect.left - inputRect.right, 2) + 
      Math.pow(buttonRect.top - inputRect.top, 2)
    );
    
    const inputContainer = input.closest('form, div, section, main');
    const buttonContainer = button.closest('form, div, section, main');
    const sameContainer = inputContainer && buttonContainer && inputContainer === buttonContainer;
    
    return distance < 300 || sameContainer;
  }

  findNearbyButton(input) {
    if (!input) return null;
    
    const container = input.closest('form, div, section') || input.parentElement;
    if (!container) return null;
    
    const buttons = container.querySelectorAll('button');
    for (const button of buttons) {
      if (button.offsetParent !== null && !button.disabled) {
        const rect = button.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return button;
        }
      }
    }
    
    return null;
  }

  findChatContainer() {
    const selectors = [
      '[data-testid="conversation-turn"]',
      '[data-testid="conversation-turn-2"]',
      '[data-testid="conversation-turn-3"]',
      '[data-testid="conversation-turn-4"]',
      '[data-testid="conversation-turn-5"]',
      '[data-testid="conversation-turn-6"]',
      '[data-testid="conversation-turn-7"]',
      '[data-testid="conversation-turn-8"]',
      '[data-testid="conversation-turn-9"]',
      '[data-testid="conversation-turn-10"]',
      '[data-testid="conversation-turn-11"]',
      '[data-testid="conversation-turn-12"]',
      '[data-testid="conversation-turn-13"]',
      '[data-testid="conversation-turn-14"]',
      '[data-testid="conversation-turn-15"]',
      '[data-testid="conversation-turn-16"]',
      '[data-testid="conversation-turn-17"]',
      '[data-testid="conversation-turn-18"]',
      '[data-testid="conversation-turn-19"]',
      '[data-testid="conversation-turn-20"]',
      '.flex-1',
      '.overflow-hidden',
      '.w-full',
      '.chat-container',
      '.messages-container',
      '.conversation',
      '[data-testid="messages"]',
      '.chat-messages',
      'main',
      '.main-content',
      '.chat-area',
      '.chat-wrapper',
      '.conversation-container',
      '.message-list',
      '.chat-history',
      'section',
      '.content',
      '.app-content'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }
    
    return document.body;
  }

  async extractLatestResponse() {
    const input = document.querySelector('textarea, input[type="text"], [contenteditable="true"]');
    const currentPrompt = input ? (input.getAttribute('contenteditable') === 'true' ? input.textContent : input.value) : '';
    
    const responseSelectors = [
      '[data-testid="conversation-turn-2"]',
      '[data-testid="conversation-turn-4"]',
      '[data-testid="conversation-turn-6"]',
      '[data-testid="conversation-turn-8"]',
      '[data-testid="conversation-turn-10"]',
      '[data-testid="conversation-turn-12"]',
      '[data-testid="conversation-turn-14"]',
      '[data-testid="conversation-turn-16"]',
      '[data-testid="conversation-turn-18"]',
      '[data-testid="conversation-turn-20"]',
      '.text-base',
      '.prose',
      '.whitespace-pre-wrap',
      '[class*="text-base"]',
      '[class*="prose"]',
      '[class*="whitespace-pre-wrap"]',
      '.message:not(.user-message)',
      '.response',
      '.assistant-message',
      '.ai-message',
      '[data-role="assistant"]',
      '.message:last-child:not(.user)',
      '.chat-message:not(.user)',
      '.message-content:not(.user)',
      '[data-testid="assistant-message"]',
      '.assistant',
      '.bot-message',
      '.ai-response',
      '.message:not([data-role="user"])',
      '.chat-message:not([data-role="user"])',
      '.message:not(.user)',
      '.chat-message:not(.user)',
      '.message:not(:has(.user-avatar))',
      '.chat-message:not(:has(.user-avatar))',
      '.message:has(.bot-avatar)',
      '.chat-message:has(.bot-avatar)',
      '.message:has(.ai-avatar)',
      '.chat-message:has(.ai-avatar)'
    ];
    
    // First, find a complete and stable response
    let completeResponseElement = null;
    
    for (const selector of responseSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        
        if (elements.length > 0) {
          const lastElement = elements[elements.length - 1];
          
          const loadingIndicators = lastElement.querySelectorAll('.loading, .spinner, .typing, .thinking, .generating, .streaming, .cursor, .blink');
          const hasLoading = loadingIndicators.length > 0;
          
          const completionIndicators = lastElement.querySelectorAll('.complete, .finished, .done, [data-status="complete"], [data-status="finished"]');
          const hasCompletionIndicator = completionIndicators.length > 0;
          
          const cursorElements = lastElement.querySelectorAll('.cursor, .blink, .typing-indicator, .streaming-indicator');
          const hasCursor = cursorElements.length > 0;
          
          const text = lastElement.textContent || lastElement.innerText || '';
          
          if (!hasLoading && !hasCursor && text.trim().length > 20) {
            if (this.isResponseComplete(lastElement)) {
              completeResponseElement = lastElement;
              break;
            }
          }
        }
      } catch (error) {
        // Silently continue
      }
    }
    
    // If no complete response found in selectors, try fallback text elements
    if (!completeResponseElement) {
      const textElements = document.querySelectorAll('[class*="text-base"], [class*="prose"], [class*="whitespace-pre-wrap"]');
      
      for (let i = textElements.length - 1; i >= 0; i--) {
        const element = textElements[i];
        const text = element.textContent || element.innerText || '';
        
        if (text.includes(currentPrompt)) {
          continue;
        }
        
        const hasCursor = element.querySelectorAll('.cursor, .blink, .typing-indicator, .streaming-indicator').length > 0;
        
        if (text.trim().length > 50 && !hasCursor) {
          if (this.isResponseComplete(element)) {
            completeResponseElement = element;
            break;
          }
        }
      }
    }
    
    // If we found a complete response, extract the text content
    if (completeResponseElement) {
      const text = completeResponseElement.textContent || completeResponseElement.innerText || '';
      if (text.trim().length > 20) {
        return text;
      }
    }
    
    return null;
  }

  async extractMarkdownViaCopyButton() {
    try {
      const copyButtonSelectors = [
        'button[data-testid="copy-turn-action-button"]',
        // 'button[aria-label="Copy"]',
        // 'button[aria-label="copy"]',
        // 'button[title="Copy"]',
        // 'button[title="copy"]'
      ];
      
      // Find all copy buttons
      let allCopyButtons = [];
      for (const selector of copyButtonSelectors) {
        try {
          const buttons = document.querySelectorAll(selector);
          allCopyButtons = allCopyButtons.concat(Array.from(buttons));
        } catch (error) {
          // Silently continue
        }
      }
      
      // Also look for buttons with the specific SVG path
      // const buttonsWithSVG = document.querySelectorAll('button:has(svg)');
      // for (const button of buttonsWithSVG) {
      //   const svg = button.querySelector('svg');
      //   if (svg) {
      //     const path = svg.querySelector('path');
      //     if (path && path.getAttribute('d') && path.getAttribute('d').includes('M12.668 10.667')) {
      //       allCopyButtons.push(button);
      //     }
      //   }
      // }
      
      // Remove duplicates and filter visible buttons
      allCopyButtons = [...new Set(allCopyButtons)];
      const visibleCopyButtons = allCopyButtons.filter(button => 
        button.offsetParent !== null && 
        !button.disabled && 
        button.getBoundingClientRect().width > 0 &&
        button.getBoundingClientRect().height > 0
      );
      
      if (visibleCopyButtons.length === 0) {
        return null;
      }
      
      // Get the last copy button (most recent response)
      const lastCopyButton = visibleCopyButtons[visibleCopyButtons.length - 1];

      // Try direct text extraction first (safest method)
      const directContent = this.extractTextDirectly(lastCopyButton);
      if (directContent && directContent.trim().length > 20) {
        return directContent.trim();
      }

      // Only try clipboard methods if we have permission and it's safe
      if (navigator.clipboard && navigator.clipboard.readText) {
        try {
          // Try clipboard extraction with better error handling
          const clipboardContent = await this.tryClipboardExtraction(lastCopyButton);
          if (clipboardContent) {
            return clipboardContent;
          }
        } catch (error) {
          // If clipboard fails, continue to other methods
        }
      }

      // Try simulated copy (less intrusive)
      try {
        const simulatedContent = await this.trySimulatedCopy(lastCopyButton);
        if (simulatedContent) {
          return simulatedContent;
        }
      } catch (error) {
        // Continue to next method
      }

      // Try selection-based extraction (safest fallback)
      try {
        const selectionContent = await this.trySelectionBasedExtraction(lastCopyButton);
        if (selectionContent) {
          return selectionContent;
        }
      } catch (error) {
        // Continue to final fallback
      }

      // Final fallback
      const fallbackContent = this.extractTextFromResponseContainer(lastCopyButton);
      if (fallbackContent) {
        return fallbackContent;
      }

      return null;
    } catch (error) {
      // If any error occurs, return null to fall back to normal text extraction
      return null;
    }
  }

  extractTextDirectly(copyButton) {
    try {
      const responseContainer = this.findResponseContainerForCopyButton(copyButton);
      if (!responseContainer) {
        return null;
      }

      const contentSelectors = [
        '[class*="text-base"]',
        '[class*="prose"]',
        '[class*="whitespace-pre-wrap"]',
        '[class*="markdown"]',
        '.message-content',
        '.response-content',
        '.assistant-content',
        '[data-testid*="turn"]',
        '.flex-1',
        '.overflow-hidden'
      ];

      for (const selector of contentSelectors) {
        const elements = responseContainer.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent || element.innerText || '';
          if (text.trim().length > 50) {
            return text;
          }
        }
      }

      const containerText = responseContainer.textContent || responseContainer.innerText || '';
      if (containerText.trim().length > 50) {
        return containerText;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async tryClipboardExtraction(copyButton) {
    // Early return if copy button is not valid
    if (!copyButton || typeof copyButton.click !== 'function') {
      return null;
    }
    
    // Store original clipboard content
    let originalClipboard = '';
    let clipboardRestored = false;
    
    // Set up a temporary error handler to catch any errors from ChatGPT's internal code
    let originalErrorHandler = window.onerror;
    let errorCaught = false;
    
    const tempErrorHandler = (message, source, lineno, colno, error) => {
      // Only catch errors that seem to be related to our copy operation
      if (message && (message.includes('setData') || message.includes('undefined'))) {
        errorCaught = true;
        return true; // Prevent the error from being logged
      }
      return false; // Let other errors through
    };
    
    try {
      window.onerror = tempErrorHandler;
      // Check if we have clipboard permissions
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        return null;
      }
      
      // Try to read original clipboard content
      try {
        originalClipboard = await navigator.clipboard.readText();
      } catch (error) {
        // If we can't read clipboard, that's okay - continue without backup
      }

      // Try to focus window (but don't fail if it doesn't work)
      try {
        window.focus();
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Continue without focus
      }

      // Check if the copy button is safe to click
      const isButtonSafe = copyButton && 
                          copyButton.offsetParent !== null && 
                          !copyButton.disabled && 
                          copyButton.getBoundingClientRect().width > 0 &&
                          copyButton.getBoundingClientRect().height > 0;
      
      if (!isButtonSafe) {
        console.warn('Copy button is not safe to click, skipping clipboard extraction');
        return null;
      }
      
      // Check if the page is in a stable state (no loading indicators)
      const loadingIndicators = document.querySelectorAll('.loading, .spinner, .typing, .thinking, .generating, .streaming, .cursor, .blink');
      if (loadingIndicators.length > 0) {
        console.warn('Page is still loading, skipping clipboard extraction');
        return null;
      }
      
      // Click the copy button with error handling
      try {
        // Use a more defensive approach to avoid triggering internal errors
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        copyButton.dispatchEvent(clickEvent);
      } catch (clickError) {
        // If the click fails, try alternative methods
        try {
          copyButton.click();
        } catch (fallbackClickError) {
          // If both fail, continue without clicking
          console.warn('Copy button click failed, continuing without clipboard extraction');
        }
      }

      // Wait for clipboard to be updated with multiple retries and timeout
      let markdownContent = '';
      const maxWaitTime = 3000; // 3 seconds max
      const startTime = Date.now();
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        const waitTime = Math.min(500 * attempt, maxWaitTime - (Date.now() - startTime));
        if (waitTime <= 0) break;
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        try {
          markdownContent = await navigator.clipboard.readText();
          
          if (markdownContent && markdownContent.trim().length > 20) {
            break;
          }
        } catch (error) {
          // Continue to next attempt
        }
      }

      // Restore original clipboard content if we had it
      if (originalClipboard && !clipboardRestored) {
        try {
          await navigator.clipboard.writeText(originalClipboard);
          clipboardRestored = true;
        } catch (error) {
          // Ignore restore errors
        }
      }

      if (markdownContent && markdownContent.trim().length > 20) {
        return markdownContent.trim();
      }

    } catch (error) {
      // If any error occurs, try to restore clipboard
      if (originalClipboard && !clipboardRestored) {
        try {
          await navigator.clipboard.writeText(originalClipboard);
        } catch (restoreError) {
          // Ignore restore errors
        }
      }
    } finally {
      // Always restore the original error handler
      window.onerror = originalErrorHandler;
    }
    
    return null;
  }

  async trySimulatedCopy(copyButton) {
    try {
      const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
      copyButton.dispatchEvent(copyEvent);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      try {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText && clipboardText.trim().length > 20) {
          return clipboardText.trim();
        }
      } catch (error) {
        // Continue to fallback
      }
      
      const responseContainer = this.findResponseContainerForCopyButton(copyButton);
      if (responseContainer) {
        const fallbackContent = this.extractTextFromContainer(responseContainer);
        if (fallbackContent && fallbackContent.trim().length > 20) {
          return fallbackContent.trim();
        }
      }
      
    } catch (error) {
      // Continue to next method
    }
    
    return null;
  }

  async trySelectionBasedExtraction(copyButton) {
    try {
      const responseContainer = this.findResponseContainerForCopyButton(copyButton);
      if (!responseContainer) {
        return null;
      }

      const selection = window.getSelection();
      if (!selection) {
        return null;
      }
      
      const range = document.createRange();
      
      // Clear any existing selection
      try {
        selection.removeAllRanges();
      } catch (error) {
        // Continue even if clearing fails
      }
      
      // Select the entire response container
      try {
        range.selectNodeContents(responseContainer);
        selection.addRange(range);
      } catch (error) {
        // If selection fails, try alternative approach
        return null;
      }
      
      // Wait a moment for selection to be applied
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try to get selected text
      let selectedText = '';
      try {
        selectedText = selection.toString();
      } catch (error) {
        // Continue to fallback
      }
      
      if (selectedText && selectedText.trim().length > 20) {
        // Clear selection
        try {
          selection.removeAllRanges();
        } catch (error) {
          // Ignore clearing errors
        }
        return selectedText.trim();
      }
      
      // Clear selection
      try {
        selection.removeAllRanges();
      } catch (error) {
        // Ignore clearing errors
      }
      
      // If selection didn't work, try to find the best text element and select it
      const textElements = responseContainer.querySelectorAll('[class*="text-base"], [class*="prose"], [class*="whitespace-pre-wrap"]');
      
      for (const element of textElements) {
        const text = element.textContent || element.innerText || '';
        if (text.trim().length > 50) {
          // Select this specific element
          try {
            selection.removeAllRanges();
            const elementRange = document.createRange();
            elementRange.selectNodeContents(element);
            selection.addRange(elementRange);
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const elementSelectedText = selection.toString();
            if (elementSelectedText && elementSelectedText.trim().length > 20) {
              try {
                selection.removeAllRanges();
              } catch (error) {
                // Ignore clearing errors
              }
              return elementSelectedText.trim();
            }
            
            try {
              selection.removeAllRanges();
            } catch (error) {
              // Ignore clearing errors
            }
          } catch (error) {
            // Continue to next element
            try {
              selection.removeAllRanges();
            } catch (clearError) {
              // Ignore clearing errors
            }
          }
        }
      }
      
    } catch (error) {
      // Clear any lingering selection
      try {
        if (window.getSelection) {
          window.getSelection().removeAllRanges();
        }
      } catch (e) {
        // Ignore errors when clearing selection
      }
    }
    
    return null;
  }

  extractTextFromResponseContainer(copyButton) {
    const responseContainer = this.findResponseContainerForCopyButton(copyButton);
    if (responseContainer) {
      const fallbackContent = this.extractTextFromContainer(responseContainer);
      if (fallbackContent && fallbackContent.trim().length > 20) {
        return fallbackContent.trim();
      }
    }
    
    return null;
  }

  findResponseContainerForCopyButton(copyButton) {
    let container = copyButton.parentElement;
    let depth = 0;
    const maxDepth = 10;
    
    while (container && depth < maxDepth) {
      if (container.className && (
        container.className.includes('message') ||
        container.className.includes('response') ||
        container.className.includes('assistant') ||
        container.className.includes('turn') ||
        container.className.includes('conversation') ||
        container.getAttribute('data-testid')?.includes('turn') ||
        container.getAttribute('data-testid')?.includes('message')
      )) {
        return container;
      }
      
      container = container.parentElement;
      depth++;
    }
    
    return null;
  }

  extractTextFromContainer(container) {
    if (!container) return null;
    
    const contentSelectors = [
      '[class*="text-base"]',
      '[class*="prose"]',
      '[class*="whitespace-pre-wrap"]',
      '[class*="markdown"]',
      '.message-content',
      '.response-content',
      '.assistant-content'
    ];
    
    for (const selector of contentSelectors) {
      const element = container.querySelector(selector);
      if (element) {
        const text = element.textContent || element.innerText || '';
        if (text.trim().length > 20) {
          return text;
        }
      }
    }
    
    const text = container.textContent || container.innerText || '';
    if (text.trim().length > 20) {
      return text;
    }
    
    return null;
  }

  isResponseComplete(responseElement) {
    if (!responseElement) return false;
    
    const completionSelectors = [
      '.complete',
      '.finished', 
      '.done',
      '[data-status="complete"]',
      '[data-status="finished"]',
      '[data-streaming="false"]',
      '[data-streaming="complete"]'
    ];
    
    for (const selector of completionSelectors) {
      if (responseElement.querySelector(selector)) {
        return true;
      }
    }
    
    const streamingSelectors = [
      '.streaming',
      '.typing',
      '.generating',
      '.thinking',
      '.loading',
      '.cursor',
      '.blink',
      '.typing-indicator',
      '.streaming-indicator',
      '[data-streaming="true"]',
      '[data-status="streaming"]'
    ];
    
    for (const selector of streamingSelectors) {
      if (responseElement.querySelector(selector)) {
        return false;
      }
    }
    
    const text = responseElement.textContent || responseElement.innerText || '';
    
    const endingPatterns = [
      /[.!?]\s*$/,
      /\n\s*$/,
      /(?:Thank you|Hope this helps|Let me know|Does this help|Is there anything else)/i,
      /(?:I hope|I trust|This should|This will)/i
    ];
    
    const hasEndingPattern = endingPatterns.some(pattern => pattern.test(text.trim()));
    const hasSubstantialLength = text.trim().length > 50;
    const hasCompleteSentences = /[.!?]/.test(text);
    
    return hasSubstantialLength && (hasEndingPattern || hasCompleteSentences);
  }

  async tryAlternativeSubmission(input, prompt) {
    // Try Enter key
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const isEmptyAfterEnter = input.getAttribute('contenteditable') === 'true' ? 
      input.textContent.trim() === '' : 
      input.value === '';
    
    if (isEmptyAfterEnter) {
      return true;
    }
    
    // Try Ctrl+Enter
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ctrlKey: true, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ctrlKey: true, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ctrlKey: true, bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const isEmptyAfterCtrlEnter = input.getAttribute('contenteditable') === 'true' ? 
      input.textContent.trim() === '' : 
      input.value === '';
    
    if (isEmptyAfterCtrlEnter) {
      return true;
    }
    
    // Try Shift+Enter
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, shiftKey: true, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, shiftKey: true, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, shiftKey: true, bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const isEmptyAfterShiftEnter = input.getAttribute('contenteditable') === 'true' ? 
      input.textContent.trim() === '' : 
      input.value === '';
    
    if (isEmptyAfterShiftEnter) {
      return true;
    }
    
    // Try form submission
    const form = input.closest('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const isEmptyAfterForm = input.getAttribute('contenteditable') === 'true' ? 
        input.textContent.trim() === '' : 
        input.value === '';
      
      if (isEmptyAfterForm) {
        return true;
      }
    }
    
    // Try nearby clickable
    const nearbyClickable = this.findNearbyClickable(input);
    if (nearbyClickable) {
      nearbyClickable.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const isEmptyAfterClick = input.getAttribute('contenteditable') === 'true' ? 
        input.textContent.trim() === '' : 
        input.value === '';
      
      if (isEmptyAfterClick) {
        return true;
      }
    }
    
    return false;
  }

  findNearbyClickable(input) {
    if (!input) return null;
    
    const container = input.closest('form, div, section') || input.parentElement;
    if (!container) return null;
    
    const clickableSelectors = [
      'button',
      'a',
      '[role="button"]',
      '[tabindex="0"]',
      '[class*="icon-button"]',
      '[class*="button"]'
    ];
    
    for (const selector of clickableSelectors) {
      const elements = container.querySelectorAll(selector);
      for (const element of elements) {
        if (element.offsetParent !== null && !element.disabled) {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return element;
          }
        }
      }
    }
    
    return null;
  }
}

// Export for use in content.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OpenAIHandler;
} 