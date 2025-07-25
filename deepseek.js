// DeepSeek-specific implementation
class DeepSeekHandler {
  constructor() {
    this.siteName = 'DeepSeek';
  }

  clearResponseCache() {
    // DeepSeek doesn't use copy button caching, but keeping interface consistent
    console.log('Clearing DeepSeek response cache (no-op)');
  }

  createNewPromptWindow() {
    console.log('Creating new DeepSeek prompt window...');
    
    // Try to find and click a "New Chat" or "Clear" button instead of refreshing
    const newChatSelectors = [
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
      '[data-testid="clear-chat"]'
    ];
    
    for (const selector of newChatSelectors) {
      try {
        const button = document.querySelector(selector);
        if (button && button.offsetParent !== null && !button.disabled) {
          console.log('Found DeepSeek new chat button:', selector);
          button.click();
          return;
        }
      } catch (error) {
        console.log(`Error with DeepSeek selector "${selector}":`, error.message);
      }
    }
    
    // If no new chat button found, try to clear the input field
    console.log('No new chat button found, clearing input field instead...');
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
    
    // Fallback: if we're not on the right page, navigate without refresh
    const currentUrl = window.location.href;
    const baseUrl = 'https://chat.deepseek.com';
    
    if (!currentUrl.startsWith(baseUrl)) {
      console.log('Navigating to DeepSeek chat page...');
      window.location.href = baseUrl;
    }
  }

  debugPageStructure() {
    console.log('=== DeepSeek Page Structure Debug ===');
    
    // Log all textareas
    const textareas = document.querySelectorAll('textarea');
    console.log(`Found ${textareas.length} textareas:`, Array.from(textareas).map(t => ({
      placeholder: t.placeholder,
      value: t.value?.substring(0, 30) + '...',
      visible: t.offsetParent !== null
    })));
    
    // Log all buttons
    const buttons = document.querySelectorAll('button');
    console.log(`Found ${buttons.length} buttons:`, Array.from(buttons).map(b => ({
      text: b.textContent?.trim(),
      ariaLabel: b.getAttribute('aria-label'),
      title: b.getAttribute('title'),
      disabled: b.disabled,
      visible: b.offsetParent !== null
    })));
    
    // Log all contenteditable elements
    const contentEditable = document.querySelectorAll('[contenteditable="true"]');
    console.log(`Found ${contentEditable.length} contenteditable elements:`, Array.from(contentEditable).map(c => ({
      text: c.textContent?.substring(0, 30) + '...',
      visible: c.offsetParent !== null
    })));
    
    // Log DeepSeek specific elements
    const markdownElements = document.querySelectorAll('[class*="markdown"], [class*="ds-markdown"]');
    console.log(`Found ${markdownElements.length} markdown elements:`, Array.from(markdownElements).map(m => ({
      classes: m.className,
      textLength: (m.textContent || m.innerText || '').length,
      textPreview: (m.textContent || m.innerText || '').substring(0, 100) + '...'
    })));
    
    // Log elements with the specific classes from your example
    const specificElements = document.querySelectorAll('[class*="_4f9bf79"], [class*="d7dc56a8"], [class*="_43c05b5"]');
    console.log(`Found ${specificElements.length} specific DeepSeek elements:`, Array.from(specificElements).map(s => ({
      classes: s.className,
      textLength: (s.textContent || s.innerText || '').length,
      textPreview: (s.textContent || s.innerText || '').substring(0, 100) + '...'
    })));
    
    // Log all divs with substantial text content
    const allDivs = document.querySelectorAll('div');
    const substantialDivs = Array.from(allDivs).filter(d => {
      const text = d.textContent || d.innerText || '';
      return text.trim().length > 50;
    });
    console.log(`Found ${substantialDivs.length} divs with substantial text:`, substantialDivs.map(d => ({
      classes: d.className,
      textLength: (d.textContent || d.innerText || '').length,
      textPreview: (d.textContent || d.innerText || '').substring(0, 100) + '...'
    })));
    
    // Log all clickable elements
    const clickableElements = document.querySelectorAll('button, a, [role="button"], [tabindex="0"], .ds-icon-button, [class*="ds-icon-button"], [class*="icon-button"], [class*="button"]');
    console.log(`Found ${clickableElements.length} clickable elements:`, Array.from(clickableElements).map(c => ({
      tagName: c.tagName,
      classes: c.className,
      text: c.textContent?.trim(),
      ariaLabel: c.getAttribute('aria-label'),
      title: c.getAttribute('title'),
      disabled: c.disabled,
      visible: c.offsetParent !== null,
      rect: c.getBoundingClientRect()
    })));
    
    console.log('=== End DeepSeek Debug ===');
  }

  async findInputField() {
    // DeepSeek-specific selectors
    const selectors = [
      'textarea[placeholder*="message"]',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Ask"]',
      'textarea[placeholder*="ask"]',
      'textarea[placeholder*="Type"]',
      'textarea[placeholder*="type"]',
      'textarea[placeholder*="Enter"]',
      'textarea[placeholder*="enter"]',
      'input[type="text"]',
      'input[placeholder*="message"]',
      'input[placeholder*="Message"]',
      'input[placeholder*="Ask"]',
      'input[placeholder*="ask"]',
      'textarea',
      '[contenteditable="true"]',
      '[data-testid="input"]',
      '[data-testid="message-input"]',
      '[data-testid="chat-input"]',
      '.input-field',
      '.message-input',
      '.chat-input',
      '.prompt-input',
      'form textarea',
      'form input[type="text"]'
    ];
    
    console.log('Searching for DeepSeek input field...');
    
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`DeepSeek selector "${selector}" found ${elements.length} elements`);
        
        for (const element of elements) {
          if (element && element.offsetParent !== null) { // Check if visible
            const rect = element.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            const isEditable = element.tagName === 'TEXTAREA' || 
                             element.tagName === 'INPUT' || 
                             element.getAttribute('contenteditable') === 'true';
            
            console.log(`DeepSeek input field found with selector "${selector}":`, {
              visible: isVisible,
              editable: isEditable,
              tagName: element.tagName,
              placeholder: element.placeholder,
              value: element.value?.substring(0, 50) + '...',
              rect: rect
            });
            
            if (isVisible && isEditable) {
              console.log('Found DeepSeek input field with selector:', selector);
              return element;
            }
          }
        }
      } catch (error) {
        console.log(`Error with DeepSeek selector "${selector}":`, error.message);
      }
    }
    
    console.log('No DeepSeek input field found with selectors');
    return null;
  }

  async findSubmitButton() {
    // DeepSeek-specific selectors
    const selectors = [
      // DeepSeek specific selectors (based on the HTML structure)
      '.ds-icon-button:has(svg)',
      '[class*="ds-icon-button"]:has(svg)',
      'button[class*="ds-icon"]',
      'button[class*="icon-button"]',
      // Look for the specific button structure from your example
      'div[class*="ds-icon-button"]:has(svg)',
      '[class*="ds-icon-button"]',
      // Traditional selectors
      'button[type="submit"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="send"]',
      'button[aria-label*="Submit"]',
      'button[aria-label*="submit"]',
      'button[title*="Send"]',
      'button[title*="send"]',
      'button[title*="Submit"]',
      'button[title*="submit"]',
      'button:has(svg)',
      'button[data-testid="send"]',
      'button[data-testid="submit"]',
      '.send-button',
      '.submit-button',
      'button:last-child',
      'button:has([data-icon="send"])',
      'button:has([data-icon="arrow"])',
      'button:has([data-icon="paper-plane"])',
      'button:has([data-icon="send-message"])',
      // More generic selectors
      'button[class*="send"]',
      'button[class*="submit"]',
      'button[class*="Send"]',
      'button[class*="Submit"]',
      // Look for buttons near the input field
      'textarea + button',
      'input + button',
      '[contenteditable="true"] + button',
      // Look for buttons with specific text content
      'button:contains("Send")',
      'button:contains("Submit")',
      'button:contains("→")',
      'button:contains("➤")'
    ];
    
    console.log('Searching for DeepSeek submit button...');
    
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`DeepSeek selector "${selector}" found ${elements.length} elements`);
        
        for (const element of elements) {
          if (element && element.offsetParent !== null && !element.disabled) {
            // Additional checks for button visibility and relevance
            const rect = element.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            const isNearInput = this.isNearInputField(element);
            
            console.log(`DeepSeek button found with selector "${selector}":`, {
              visible: isVisible,
              nearInput: isNearInput,
              disabled: element.disabled,
              text: element.textContent?.trim(),
              ariaLabel: element.getAttribute('aria-label'),
              title: element.getAttribute('title'),
              classes: element.className,
              tagName: element.tagName
            });
            
            if (isVisible && isNearInput) {
              console.log('Found DeepSeek submit button with selector:', selector);
              return element;
            }
          }
        }
      } catch (error) {
        console.log(`Error with DeepSeek selector "${selector}":`, error.message);
      }
    }
    
    // If no button found, try to find any clickable element near the input
    console.log('No DeepSeek submit button found with selectors, trying fallback...');
    const input = await this.findInputField();
    if (input) {
      const nearbyButton = this.findNearbyButton(input);
      if (nearbyButton) {
        console.log('Found nearby DeepSeek button as fallback');
        return nearbyButton;
      }
    }
    
    console.log('No DeepSeek submit button found');
    return null;
  }

  isNearInputField(button) {
    const input = document.querySelector('textarea, input[type="text"], [contenteditable="true"]');
    if (!input || !button) return false;
    
    const inputRect = input.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    
    // Check if button is within reasonable distance of input
    const distance = Math.sqrt(
      Math.pow(buttonRect.left - inputRect.right, 2) + 
      Math.pow(buttonRect.top - inputRect.top, 2)
    );
    
    return distance < 200; // Within 200px
  }

  findNearbyButton(input) {
    if (!input) return null;
    
    // Look for buttons in the same container or nearby
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
    console.log('Finding DeepSeek chat container...');
    
    // DeepSeek-specific selectors
    const selectors = [
      '.chat-container',
      '.messages-container',
      '.conversation',
      '[data-testid="messages"]',
      '.chat-messages',
      'main',
      '.main-content',
      '.chat-area',
      // DeepSeek specific selectors
      '[data-testid="chat-container"]',
      '.chat-wrapper',
      '.conversation-container',
      '.message-list',
      '.chat-history',
      // More generic selectors
      'section',
      '.content',
      '.app-content'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log('Found DeepSeek chat container with selector:', selector);
        return element;
      }
    }
    
    console.log('No specific DeepSeek chat container found, using body as fallback');
    return document.body; // Fallback to body
  }

  async extractLatestResponse() {
    console.log('Extracting latest DeepSeek response...');
    
    // Get the current prompt from the input field to help identify user messages
    const input = document.querySelector('textarea, input[type="text"], [contenteditable="true"]');
    const currentPrompt = input ? (input.getAttribute('contenteditable') === 'true' ? input.textContent : input.value) : '';
    
    // DeepSeek-specific selectors for response elements
    const responseSelectors = [
      // DeepSeek specific selectors (based on the HTML structure you provided)
      '.ds-markdown--block',
      '.ds-markdown',
      '[class*="ds-markdown"]',
      '[class*="markdown"]',
      // More generic DeepSeek selectors
      'div[class*="assistant"]',
      'div[class*="bot"]',
      'div[class*="ai"]',
      // Traditional selectors
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
    
    for (const selector of responseSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`DeepSeek selector "${selector}" found ${elements.length} elements`);
        
        if (elements.length > 0) {
          const lastElement = elements[elements.length - 1];
          
          // Check if this response is complete (no loading indicators)
          const loadingIndicators = lastElement.querySelectorAll('.loading, .spinner, .typing, .thinking, .generating, .streaming, .cursor, .blink');
          const hasLoading = loadingIndicators.length > 0;
          
          // Check for streaming completion indicators
          const completionIndicators = lastElement.querySelectorAll('.complete, .finished, .done, [data-status="complete"], [data-status="finished"]');
          const hasCompletionIndicator = completionIndicators.length > 0;
          
          // Check for cursor or typing indicators that suggest streaming is still active
          const cursorElements = lastElement.querySelectorAll('.cursor, .blink, .typing-indicator, .streaming-indicator');
          const hasCursor = cursorElements.length > 0;
          
          const text = lastElement.textContent || lastElement.innerText || '';
          
          console.log(`Last DeepSeek element with selector "${selector}":`, {
            hasLoading,
            hasCompletionIndicator,
            hasCursor,
            textLength: text.length,
            textPreview: text.substring(0, 100) + '...',
            isSubstantial: text.trim().length > 20
          });
          
          // Only return response if it's substantial and not actively streaming
          if (!hasLoading && !hasCursor && text.trim().length > 20) {
            // Use the new completion detection function
            if (this.isResponseComplete(lastElement)) {
              console.log('Found complete DeepSeek response with selector:', selector);
              return text;
            }
          }
        }
      } catch (error) {
        console.log(`Error with DeepSeek selector "${selector}":`, error.message);
      }
    }
    
    // DeepSeek specific fallback: look for the markdown content structure
    console.log('Trying DeepSeek-specific fallback...');
    const markdownElements = document.querySelectorAll('[class*="markdown"], [class*="ds-markdown"]');
    console.log(`Found ${markdownElements.length} DeepSeek markdown elements`);
    
    for (let i = markdownElements.length - 1; i >= 0; i--) {
      const element = markdownElements[i];
      const text = element.textContent || element.innerText || '';
      
      // Skip if it contains the current prompt (likely user message)
      if (text.includes(currentPrompt)) {
        continue;
      }
      
      // Check for streaming indicators
      const hasCursor = element.querySelectorAll('.cursor, .blink, .typing-indicator, .streaming-indicator').length > 0;
      
      // Check if this looks like a complete response (has substantial content and ending)
      if (text.trim().length > 50 && !hasCursor) { // At least 50 characters
        if (this.isResponseComplete(element)) {
          console.log('Found response with DeepSeek markdown fallback');
          return text;
        }
      }
    }
    
    console.log('No complete DeepSeek response found');
    return null;
  }



  isResponseComplete(responseElement) {
    if (!responseElement) return false;
    
    // Check for explicit completion indicators
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
        console.log('Found explicit completion indicator:', selector);
        return true;
      }
    }
    
    // Check for streaming indicators that should NOT be present
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
        console.log('Found streaming indicator, response not complete:', selector);
        return false;
      }
    }
    
    // Check the text content for completion patterns
    const text = responseElement.textContent || responseElement.innerText || '';
    
    // Look for common ending patterns
    const endingPatterns = [
      /[.!?]\s*$/, // Ends with punctuation
      /\n\s*$/, // Ends with newline
      /(?:Thank you|Hope this helps|Let me know|Does this help|Is there anything else)/i, // Common ending phrases
      /(?:I hope|I trust|This should|This will)/i // More ending patterns
    ];
    
    const hasEndingPattern = endingPatterns.some(pattern => pattern.test(text.trim()));
    const hasSubstantialLength = text.trim().length > 50;
    const hasCompleteSentences = /[.!?]/.test(text); // Contains at least one sentence ending
    
    console.log('DeepSeek response completion analysis:', {
      hasEndingPattern,
      hasSubstantialLength,
      hasCompleteSentences,
      textLength: text.length,
      textEnding: text.trim().slice(-20)
    });
    
    // Response is complete if it has substantial content and either ends properly or has complete sentences
    return hasSubstantialLength && (hasEndingPattern || hasCompleteSentences);
  }

  async tryAlternativeSubmission(input, prompt) {
    // Method 1: Try pressing Enter key
    console.log('Trying DeepSeek Enter key submission...');
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    
    // Wait a moment to see if submission worked
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if the input was cleared (indicating submission)
    const isEmptyAfterEnter = input.getAttribute('contenteditable') === 'true' ? 
      input.textContent.trim() === '' : 
      input.value === '';
    
    if (isEmptyAfterEnter) {
      console.log('DeepSeek Enter key submission successful');
      return true;
    }
    
    // Method 2: Try Ctrl+Enter
    console.log('Trying DeepSeek Ctrl+Enter submission...');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ctrlKey: true, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ctrlKey: true, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ctrlKey: true, bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const isEmptyAfterCtrlEnter = input.getAttribute('contenteditable') === 'true' ? 
      input.textContent.trim() === '' : 
      input.value === '';
    
    if (isEmptyAfterCtrlEnter) {
      console.log('DeepSeek Ctrl+Enter submission successful');
      return true;
    }
    
    // Method 3: Try Shift+Enter
    console.log('Trying DeepSeek Shift+Enter submission...');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, shiftKey: true, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, shiftKey: true, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, shiftKey: true, bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const isEmptyAfterShiftEnter = input.getAttribute('contenteditable') === 'true' ? 
      input.textContent.trim() === '' : 
      input.value === '';
    
    if (isEmptyAfterShiftEnter) {
      console.log('DeepSeek Shift+Enter submission successful');
      return true;
    }
    
    // Method 4: Try form submission
    console.log('Trying DeepSeek form submission...');
    const form = input.closest('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const isEmptyAfterForm = input.getAttribute('contenteditable') === 'true' ? 
        input.textContent.trim() === '' : 
        input.value === '';
      
      if (isEmptyAfterForm) {
        console.log('DeepSeek form submission successful');
        return true;
      }
    }
    
    // Method 5: Try clicking any clickable element near the input
    console.log('Trying to find and click any clickable element near DeepSeek input...');
    const nearbyClickable = this.findNearbyClickable(input);
    if (nearbyClickable) {
      console.log('Found nearby DeepSeek clickable element, clicking it...');
      nearbyClickable.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const isEmptyAfterClick = input.getAttribute('contenteditable') === 'true' ? 
        input.textContent.trim() === '' : 
        input.value === '';
      
      if (isEmptyAfterClick) {
        console.log('DeepSeek click submission successful');
        return true;
      }
    }
    
    console.log('All DeepSeek alternative submission methods failed');
    return false;
  }

  findNearbyClickable(input) {
    if (!input) return null;
    
    // Look for any clickable element near the input
    const container = input.closest('form, div, section') || input.parentElement;
    if (!container) return null;
    
    // Look for buttons, links, or clickable divs
    const clickableSelectors = [
      'button',
      'a',
      '[role="button"]',
      '[tabindex="0"]',
      '.ds-icon-button',
      '[class*="ds-icon-button"]',
      '[class*="icon-button"]',
      '[class*="button"]'
    ];
    
    for (const selector of clickableSelectors) {
      const elements = container.querySelectorAll(selector);
      for (const element of elements) {
        if (element.offsetParent !== null && !element.disabled) {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            console.log('Found nearby DeepSeek clickable element:', selector, element);
            return element;
          }
        }
      }
    }
    
    return null;
  }

  async extractMarkdownViaCopyButton(response) {
    console.log('Attempting to extract DeepSeek response using copy button...');
    
    // For DeepSeek, we'll use the response text directly since copy button functionality may vary
    // This is a simplified implementation - you can enhance it if DeepSeek has copy buttons
    if (response && response.trim().length > 0) {
      console.log('Using provided response text for DeepSeek');
      return response;
    }
    
    // Fallback: try to find copy buttons and extract content
    const copyButtonSelectors = [
      'button[aria-label="Copy"]',
      'button[aria-label="copy"]',
      'button[title="Copy"]',
      'button[title="copy"]',
      'button[class*="copy"]',
      'button[class*="Copy"]',
      'button:has(svg[data-icon="copy"])',
      'button:has(svg[data-icon="Copy"])'
    ];
    
    let allCopyButtons = [];
    for (const selector of copyButtonSelectors) {
      try {
        const buttons = document.querySelectorAll(selector);
        allCopyButtons = allCopyButtons.concat(Array.from(buttons));
      } catch (error) {
        console.log(`Error with copy button selector "${selector}":`, error.message);
      }
    }
    
    // Remove duplicates and filter visible buttons
    allCopyButtons = [...new Set(allCopyButtons)].filter(button => 
      button.offsetParent !== null && 
      !button.disabled && 
      button.getBoundingClientRect().width > 0 &&
      button.getBoundingClientRect().height > 0
    );
    
    if (allCopyButtons.length === 0) {
      console.log('No copy buttons found for DeepSeek, returning null');
      return null;
    }
    
    // Get the last copy button (most recent response)
    const lastCopyButton = allCopyButtons[allCopyButtons.length - 1];
    
    // Store original clipboard content
    let originalClipboard = '';
    try {
      originalClipboard = await navigator.clipboard.readText();
    } catch (error) {
      console.log('Could not read original clipboard:', error.message);
    }
    
    // Click the copy button
    console.log('Clicking DeepSeek copy button...');
    lastCopyButton.click();
    
    // Wait for clipboard to be updated
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Read the clipboard content
    let markdownContent = '';
    try {
      markdownContent = await navigator.clipboard.readText();
      console.log('Successfully read DeepSeek clipboard content, length:', markdownContent.length);
    } catch (error) {
      console.log('Failed to read DeepSeek clipboard:', error.message);
      return null;
    }
    
    // Restore original clipboard content
    try {
      await navigator.clipboard.writeText(originalClipboard);
    } catch (error) {
      console.log('Could not restore original clipboard:', error.message);
    }
    
    // Validate that we got meaningful content
    if (markdownContent && markdownContent.trim().length > 20) {
      console.log('Successfully extracted DeepSeek markdown content via copy button');
      return markdownContent.trim();
    } else {
      console.log('DeepSeek clipboard content is empty or too short');
      return null;
    }
  }
}

// Export for use in content.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DeepSeekHandler;
} 