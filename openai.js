// OpenAI-specific implementation
class OpenAIHandler {
  constructor() {
    this.siteName = 'OpenAI';
  }

  createNewPromptWindow() {
    console.log('Creating new OpenAI prompt window...');
    
    // Try to find and click a "New Chat" or "Clear" button instead of refreshing
    const newChatSelectors = [
      // OpenAI specific selectors - most specific first
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
          console.log('Found OpenAI new chat button:', selector);
          button.click();
          return;
        }
      } catch (error) {
        console.log(`Error with OpenAI selector "${selector}":`, error.message);
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
    const baseUrl = 'https://chatgpt.com';
    
    if (!currentUrl.startsWith(baseUrl)) {
      console.log('Navigating to OpenAI chat page...');
      window.location.href = baseUrl;
    }
  }

  debugPageStructure() {
    console.log('=== OpenAI Page Structure Debug ===');
    
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
    
    // Log OpenAI specific elements
    const markdownElements = document.querySelectorAll('[class*="markdown"], [class*="prose"], [class*="text-base"]');
    console.log(`Found ${markdownElements.length} markdown elements:`, Array.from(markdownElements).map(m => ({
      classes: m.className,
      textLength: (m.textContent || m.innerText || '').length,
      textPreview: (m.textContent || m.innerText || '').substring(0, 100) + '...'
    })));
    
    // Log elements with OpenAI-specific classes
    const specificElements = document.querySelectorAll('[class*="text-base"], [class*="prose"], [class*="whitespace-pre-wrap"]');
    console.log(`Found ${specificElements.length} specific OpenAI elements:`, Array.from(specificElements).map(s => ({
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
    const clickableElements = document.querySelectorAll('button, a, [role="button"], [tabindex="0"], [class*="icon-button"], [class*="button"]');
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
    
    console.log('=== End OpenAI Debug ===');
  }

  async findInputField() {
    console.log('=== findInputField ===');
    // OpenAI-specific selectors
    const selectors = [
      // OpenAI specific selectors based on the actual HTML structure
      'textarea[name="prompt-textarea"]',
      'textarea[class*="fallbackTextarea"]',
    //   'textarea[placeholder*="Ask anything"]',
    //   'textarea[placeholder*="ask anything"]',
    //   'textarea[placeholder*="Message"]',
    //   'textarea[placeholder*="message"]',
    //   'textarea[placeholder*="Send a message"]',
    //   'textarea[placeholder*="send a message"]',
    //   'textarea[placeholder*="Type your message"]',
    //   'textarea[placeholder*="type your message"]',
    //   'textarea[placeholder*="Ask"]',
    //   'textarea[placeholder*="ask"]',
    //   'textarea[placeholder*="Type"]',
    //   'textarea[placeholder*="type"]',
    //   'textarea[placeholder*="Enter"]',
    //   'textarea[placeholder*="enter"]',
    //   // OpenAI specific data attributes
    //   '[data-id="root"] textarea',
    //   '[data-testid="chat-input"]',
    //   '[data-testid="message-input"]',
    //   // OpenAI specific classes
    //   '.stretch textarea',
    //   '.flex textarea',
    //   '.w-full textarea',
    //   // Traditional selectors
    //   'input[type="text"]',
    //   'input[placeholder*="message"]',
    //   'input[placeholder*="Message"]',
    //   'input[placeholder*="Ask"]',
    //   'input[placeholder*="ask"]',
    //   'textarea',
    //   '[contenteditable="true"]',
    //   '[data-testid="input"]',
    //   '.input-field',
    //   '.message-input',
    //   '.chat-input',
    //   '.prompt-input',
      'form textarea',
      'form input[type="text"]'
    ];
    
    console.log('Searching for OpenAI input field...');
    
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`OpenAI selector "${selector}" found ${elements.length} elements`);
        
        for (const element of elements) {
          if (element && element.offsetParent !== null) { // Check if visible
            const rect = element.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            const isEditable = element.tagName === 'TEXTAREA' || 
                             element.tagName === 'INPUT' || 
                             element.getAttribute('contenteditable') === 'true';
            
            console.log(`OpenAI input field found with selector "${selector}":`, {
              visible: isVisible,
              editable: isEditable,
              tagName: element.tagName,
              placeholder: element.placeholder,
              value: element.value?.substring(0, 50) + '...',
              rect: rect
            });
            
            if (isVisible && isEditable) {
              console.log('Found OpenAI input field with selector:', selector);
              return element;
            } else if (isEditable && element.style.display === 'none') {
              // Handle hidden textareas that might become visible when focused
              console.log('Found hidden OpenAI textarea, attempting to make it visible:', selector);
              element.style.display = 'block';
              element.style.visibility = 'visible';
              element.style.opacity = '1';
              
              // Wait a moment for the element to become visible
              await new Promise(resolve => setTimeout(resolve, 100));
              
              const rect = element.getBoundingClientRect();
              const isNowVisible = rect.width > 0 && rect.height > 0;
              
              if (isNowVisible) {
                console.log('Successfully made OpenAI textarea visible');
                return element;
              }
            }
          }
        }
      } catch (error) {
        console.log(`Error with OpenAI selector "${selector}":`, error.message);
      }
    }
    
    console.log('No OpenAI input field found with selectors');
    
    // Fallback: look for the actual visible input that might be a contenteditable div
    console.log('Trying fallback to find visible contenteditable input...');
    const visibleInputs = document.querySelectorAll('[contenteditable="true"], textarea:not([style*="display: none"]), input[type="text"]:not([style*="display: none"])');
    
    for (const input of visibleInputs) {
      const rect = input.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 && input.offsetParent !== null;
      
      if (isVisible) {
        console.log('Found fallback visible input:', {
          tagName: input.tagName,
          contenteditable: input.getAttribute('contenteditable'),
          placeholder: input.placeholder,
          classes: input.className
        });
        return input;
      }
    }
    
    return null;
  }

  async findSubmitButton() {
    console.log('=== findSubmitButton ===');
    // OpenAI-specific selectors
    const selectors = [
      // Exact match for the specific button structure you found
      'button[id="composer-submit-button"][data-testid="send-button"]',
      'button[id="composer-submit-button"]',
      'button[data-testid="send-button"]',
      'button[aria-label="Send prompt"]',
      'button[aria-label="Send message"]',
      'button[aria-label="Send"]',
      // OpenAI specific selectors
      'button[aria-label*="Send"]',
      'button[aria-label*="send"]',
      'button[title*="Send"]',
      'button[title*="send"]',
      // OpenAI specific classes
      'button[class*="composer-submit-btn"]',
      'button[class*="composer-submit-button"]',
      'button[class*="composer-submit"]',
      'button[class*="send"]',
      'button[class*="Send"]',
      'button[class*="submit"]',
      'button[class*="Submit"]',
      // OpenAI specific button structure with SVG icon
    //   'button:has(svg.icon)',
    //   'button:has(svg[class*="icon"])',
    //   'button:has(svg path[d*="M8.99992 16V6.41407"])',
    //   'button:has([data-icon="send"])',
    //   'button:has([data-icon="arrow"])',
    //   'button:has([data-icon="paper-plane"])',
    //   'button:has([data-icon="send-message"])',
      // Traditional selectors
      'button[type="submit"]',
      'button[aria-label*="Submit"]',
      'button[aria-label*="submit"]',
      'button[title*="Submit"]',
      'button[title*="submit"]',
      'button[data-testid="submit"]',
      '.send-button',
      '.submit-button',
    //   'button:last-child',
      // Look for buttons near the input field
      'textarea + button',
      'input + button',
      '[contenteditable="true"] + button',
      // Look for buttons with specific text content
    //   'button:contains("Send")',
    //   'button:contains("Submit")',
    //   'button:contains("→")',
    //   'button:contains("➤")'
    ];
    
    console.log('Searching for OpenAI submit button...');
    
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`OpenAI selector "${selector}" found ${elements.length} elements`);
        
        for (const element of elements) {
          if (element && element.offsetParent !== null && !element.disabled) {
            // Additional checks for button visibility and relevance
            const rect = element.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            const isNearInput = this.isNearInputField(element);
            
            console.log(`OpenAI button found with selector "${selector}":`, {
              visible: isVisible,
              nearInput: isNearInput,
              disabled: element.disabled,
              text: element.textContent?.trim(),
              ariaLabel: element.getAttribute('aria-label'),
              title: element.getAttribute('title'),
              classes: element.className,
              tagName: element.tagName,
              id: element.id,
              dataTestId: element.getAttribute('data-testid')
            });
            
            // Prioritize exact matches for the specific button structure
            const isExactMatch = (element.getAttribute('data-testid') === 'send-button' && element.id === 'composer-submit-button') || 
                               element.id === 'composer-submit-button' ||
                               element.getAttribute('data-testid') === 'send-button' ||
                               element.getAttribute('aria-label') === 'Send prompt';
            
            if (isVisible && (isExactMatch || isNearInput)) {
              console.log('Found OpenAI submit button with selector:', selector, 'Exact match:', isExactMatch);
              return element;
            }
          }
        }
      } catch (error) {
        console.log(`Error with OpenAI selector "${selector}":`, error.message);
      }
    }
    
    // If no button found, try to find any clickable element near the input
    console.log('No OpenAI submit button found with selectors, trying fallback...');
    const input = await this.findInputField();
    if (input) {
      const nearbyButton = this.findNearbyButton(input);
      if (nearbyButton) {
        console.log('Found nearby OpenAI button as fallback');
        return nearbyButton;
      }
    }
    
    // Final fallback: look for the specific button structure you found
    console.log('Trying final fallback for specific button structure...');
    const specificButton = document.querySelector('button[id="composer-submit-button"][data-testid="send-button"]');
    if (specificButton && specificButton.offsetParent !== null && !specificButton.disabled) {
      console.log('Found specific OpenAI button structure as final fallback');
      return specificButton;
    }
    
    // Look for the exact button with the specific classes
    const exactButton = document.querySelector('button.composer-submit-btn.composer-submit-button-color');
    if (exactButton && exactButton.offsetParent !== null && !exactButton.disabled) {
      console.log('Found exact OpenAI button with specific classes as final fallback');
      return exactButton;
    }
    
    // Look for any button with the composer-submit class
    const composerButton = document.querySelector('button[class*="composer-submit"]');
    if (composerButton && composerButton.offsetParent !== null && !composerButton.disabled) {
      console.log('Found composer-submit button as final fallback');
      return composerButton;
    }
    
    console.log('No OpenAI submit button found');
    return null;
  }

  isNearInputField(button) {
    console.log('=== isNearInputField ===');
    const input = document.querySelector('textarea, input[type="text"], [contenteditable="true"]');
    if (!input || !button) return false;
    
    const inputRect = input.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    
    // Check if button is within reasonable distance of input
    const distance = Math.sqrt(
      Math.pow(buttonRect.left - inputRect.right, 2) + 
      Math.pow(buttonRect.top - inputRect.top, 2)
    );
    
    // Also check if button is in the same container as input
    const inputContainer = input.closest('form, div, section, main');
    const buttonContainer = button.closest('form, div, section, main');
    const sameContainer = inputContainer && buttonContainer && inputContainer === buttonContainer;
    
    console.log('Button proximity check:', {
      distance,
      sameContainer,
      inputContainer: inputContainer?.tagName,
      buttonContainer: buttonContainer?.tagName
    });
    
    return distance < 300 || sameContainer; // Within 300px or same container
  }

  findNearbyButton(input) {
    console.log('=== findNearbyButton ===');
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
    console.log('=== findChatContainer ===');
    console.log('Finding OpenAI chat container...');
    
    // OpenAI-specific selectors
    const selectors = [
      // OpenAI specific selectors
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
      // OpenAI specific classes
      '.flex-1',
      '.overflow-hidden',
      '.w-full',
      // Traditional selectors
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
        console.log('Found OpenAI chat container with selector:', selector);
        return element;
      }
    }
    
    console.log('No specific OpenAI chat container found, using body as fallback');
    return document.body; // Fallback to body
  }

  async extractLatestResponse() {
    console.log('=== extractLatestResponse ===');
    console.log('Extracting latest OpenAI response...');
    
    // First try to get markdown content using copy button
    // const markdownContent = await this.extractMarkdownViaCopyButton();
    // if (markdownContent) {
    //   console.log('Successfully extracted OpenAI response using copy button');
    //   return markdownContent;
    // }
    
    // Get the current prompt from the input field to help identify user messages
    const input = document.querySelector('textarea, input[type="text"], [contenteditable="true"]');
    const currentPrompt = input ? (input.getAttribute('contenteditable') === 'true' ? input.textContent : input.value) : '';
    
    // OpenAI-specific selectors for response elements
    const responseSelectors = [
      // OpenAI specific selectors
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
      // OpenAI specific classes
      '.text-base',
      '.prose',
      '.whitespace-pre-wrap',
      '[class*="text-base"]',
      '[class*="prose"]',
      '[class*="whitespace-pre-wrap"]',
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
        // console.log(`OpenAI selector "${selector}" found ${elements.length} elements`);
        
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
          
        //   console.log(`Last OpenAI element with selector "${selector}":`, {
        //     hasLoading,
        //     hasCompletionIndicator,
        //     hasCursor,
        //     textLength: text.length,
        //     textPreview: text.substring(0, 100) + '...',
        //     isSubstantial: text.trim().length > 20
        //   });
          
          // Only return response if it's substantial and not actively streaming
          if (!hasLoading && !hasCursor && text.trim().length > 20) {
            // Use the new completion detection function
            if (this.isResponseComplete(lastElement)) {
            //   console.log('Found complete OpenAI response with selector:', selector);
              return text;
            }
          }
        }
      } catch (error) {
        console.log(`Error with OpenAI selector "${selector}":`, error.message);
      }
    }
    
    // OpenAI specific fallback: look for the text content structure
    console.log('Trying OpenAI-specific fallback...');
    const textElements = document.querySelectorAll('[class*="text-base"], [class*="prose"], [class*="whitespace-pre-wrap"]');
    console.log(`Found ${textElements.length} OpenAI text elements`);
    
    for (let i = textElements.length - 1; i >= 0; i--) {
      const element = textElements[i];
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
          console.log('Found response with OpenAI text fallback');
          return text;
        }
      }
    }
    
    console.log('No complete OpenAI response found');
    return null;
  }

  async extractMarkdownViaCopyButton() {
    console.log('=== extractMarkdownViaCopyButton ===');
    console.log('Attempting to extract OpenAI response using copy button...');
    
    // Find the latest response container that has a copy button
    const copyButtonSelectors = [
      // OpenAI specific copy button selectors (from your example)
      'button[data-testid="copy-turn-action-button"]',
    //   'button[aria-label="Copy"]',
    //   'button[aria-label="copy"]',
    //   'button[title="Copy"]',
    //   'button[title="copy"]',
      // More specific selectors based on your HTML example
    //   'button[class*="text-token-text-secondary"][class*="hover:bg-token-bg-secondary"]',
    //   'button[data-state="closed"]',
      // More generic copy button selectors
    //   'button:has(svg[data-icon="copy"])',
    //   'button:has(svg[data-icon="Copy"])',
    //   'button[class*="copy"]',
    //   'button[class*="Copy"]',
    //   // Look for buttons with copy-related text or icons
    //   'button:has([class*="copy"])',
    //   'button:has([class*="Copy"])',
      // Look for buttons with SVG icons that might be copy buttons
    //   'button:has(svg)'
    ];
    
    // Find all copy buttons
    let allCopyButtons = [];
    for (const selector of copyButtonSelectors) {
      try {
        const buttons = document.querySelectorAll(selector);
        console.log(`Selector "${selector}" found ${buttons.length} buttons`);
        allCopyButtons = allCopyButtons.concat(Array.from(buttons));
      } catch (error) {
        console.log(`Error with copy button selector "${selector}":`, error.message);
      }
    }
    
    // Also look for buttons with the specific SVG path from your example
    // const buttonsWithSVG = document.querySelectorAll('button:has(svg)');
    // console.log(`Found ${buttonsWithSVG.length} buttons with SVG icons`);
    // for (const button of buttonsWithSVG) {
    //   const svg = button.querySelector('svg');
    //   if (svg) {
    //     const path = svg.querySelector('path');
    //     if (path && path.getAttribute('d') && path.getAttribute('d').includes('M12.668 10.667')) {
    //       // This matches the SVG path from your example
    //       allCopyButtons.push(button);
    //       console.log('Found copy button with matching SVG path');
    //     }
    //   }
    // }
    
    console.log(`Found ${allCopyButtons.length} total potential copy buttons`);
    
    // Remove duplicates
    allCopyButtons = [...new Set(allCopyButtons)];
    console.log(`After deduplication: ${allCopyButtons.length} unique copy buttons`);
    
    // Filter to only visible, enabled buttons
    const visibleCopyButtons = allCopyButtons.filter(button => 
      button.offsetParent !== null && 
      !button.disabled && 
      button.getBoundingClientRect().width > 0 &&
      button.getBoundingClientRect().height > 0
    );
    
    console.log(`Found ${visibleCopyButtons.length} visible copy buttons`);
    
    // Log details about each visible button for debugging
    visibleCopyButtons.forEach((button, index) => {
      console.log(`Button ${index + 1}:`, {
        ariaLabel: button.getAttribute('aria-label'),
        title: button.getAttribute('title'),
        dataTestId: button.getAttribute('data-testid'),
        classes: button.className,
        rect: button.getBoundingClientRect()
      });
    });
    
    if (visibleCopyButtons.length === 0) {
      console.log('No visible copy buttons found');
      return null;
    }
    
    // Get the last copy button (most recent response)
    const lastCopyButton = visibleCopyButtons[visibleCopyButtons.length - 1];
    console.log('Using last copy button:', {
      ariaLabel: lastCopyButton.getAttribute('aria-label'),
      title: lastCopyButton.getAttribute('title'),
      dataTestId: lastCopyButton.getAttribute('data-testid'),
      classes: lastCopyButton.className
    });
    
    // Store original clipboard content
    let originalClipboard = '';
    try {
      originalClipboard = await navigator.clipboard.readText();
      console.log('Original clipboard content length:', originalClipboard.length);
    } catch (error) {
      console.log('Could not read original clipboard:', error.message);
    }
    
    // Click the copy button
    console.log('Clicking copy button...');
    lastCopyButton.click();
    
    // Wait for clipboard to be updated
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Read the clipboard content
    let markdownContent = '';
    try {
      markdownContent = await navigator.clipboard.readText();
      console.log('Successfully read clipboard content, length:', markdownContent.length);
      console.log('Clipboard content preview:', markdownContent.substring(0, 100) + '...');
    } catch (error) {
      console.log('Failed to read clipboard:', error.message);
      
      // Fallback: try to extract content from the button's parent container
      console.log('Trying fallback method to extract content...');
      const responseContainer = this.findResponseContainerForCopyButton(lastCopyButton);
      if (responseContainer) {
        const fallbackContent = this.extractTextFromContainer(responseContainer);
        if (fallbackContent && fallbackContent.trim().length > 20) {
          console.log('Successfully extracted content using fallback method');
          return fallbackContent.trim();
        }
      }
      
      return null;
    }
    
    // Restore original clipboard content
    try {
      await navigator.clipboard.writeText(originalClipboard);
      console.log('Restored original clipboard content');
    } catch (error) {
      console.log('Could not restore original clipboard:', error.message);
    }
    
    // Validate that we got meaningful content
    if (markdownContent && markdownContent.trim().length > 20) {
      console.log('Successfully extracted markdown content via copy button');
      return markdownContent.trim();
    } else {
      console.log('Clipboard content is empty or too short');
      return null;
    }
  }

  findResponseContainerForCopyButton(copyButton) {
    console.log('=== findResponseContainerForCopyButton ===');
    // Try to find the response container that contains this copy button
    let container = copyButton.parentElement;
    let depth = 0;
    const maxDepth = 10; // Prevent infinite loops
    
    while (container && depth < maxDepth) {
      // Look for common response container classes
      if (container.className && (
        container.className.includes('message') ||
        container.className.includes('response') ||
        container.className.includes('assistant') ||
        container.className.includes('turn') ||
        container.className.includes('conversation') ||
        container.getAttribute('data-testid')?.includes('turn') ||
        container.getAttribute('data-testid')?.includes('message')
      )) {
        console.log('Found response container for copy button:', container);
        return container;
      }
      
      container = container.parentElement;
      depth++;
    }
    
    console.log('Could not find response container for copy button');
    return null;
  }

  extractTextFromContainer(container) {
    console.log('=== extractTextFromContainer ===');
    if (!container) return null;
    
    // Try to find the main content area within the container
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
          console.log('Found content using selector:', selector);
          return text;
        }
      }
    }
    
    // Fallback to the container's own text content
    const text = container.textContent || container.innerText || '';
    if (text.trim().length > 20) {
      console.log('Using container text content as fallback');
      return text;
    }
    
    return null;
  }

  isResponseComplete(responseElement) {
    console.log('=== isResponseComplete ===');
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
    
    // console.log('OpenAI response completion analysis:', {
    //   hasEndingPattern,
    //   hasSubstantialLength,
    //   hasCompleteSentences,
    //   textLength: text.length,
    //   textEnding: text.trim().slice(-20)
    // });
    
    // Response is complete if it has substantial content and either ends properly or has complete sentences
    return hasSubstantialLength && (hasEndingPattern || hasCompleteSentences);
  }

  async tryAlternativeSubmission(input, prompt) {
    // Method 1: Try pressing Enter key
    console.log('Trying OpenAI Enter key submission...');
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
      console.log('OpenAI Enter key submission successful');
      return true;
    }
    
    // Method 2: Try Ctrl+Enter
    console.log('Trying OpenAI Ctrl+Enter submission...');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ctrlKey: true, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ctrlKey: true, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ctrlKey: true, bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const isEmptyAfterCtrlEnter = input.getAttribute('contenteditable') === 'true' ? 
      input.textContent.trim() === '' : 
      input.value === '';
    
    if (isEmptyAfterCtrlEnter) {
      console.log('OpenAI Ctrl+Enter submission successful');
      return true;
    }
    
    // Method 3: Try Shift+Enter
    console.log('Trying OpenAI Shift+Enter submission...');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, shiftKey: true, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, shiftKey: true, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, shiftKey: true, bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const isEmptyAfterShiftEnter = input.getAttribute('contenteditable') === 'true' ? 
      input.textContent.trim() === '' : 
      input.value === '';
    
    if (isEmptyAfterShiftEnter) {
      console.log('OpenAI Shift+Enter submission successful');
      return true;
    }
    
    // Method 4: Try form submission
    console.log('Trying OpenAI form submission...');
    const form = input.closest('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const isEmptyAfterForm = input.getAttribute('contenteditable') === 'true' ? 
        input.textContent.trim() === '' : 
        input.value === '';
      
      if (isEmptyAfterForm) {
        console.log('OpenAI form submission successful');
        return true;
      }
    }
    
    // Method 5: Try clicking any clickable element near the input
    console.log('Trying to find and click any clickable element near OpenAI input...');
    const nearbyClickable = this.findNearbyClickable(input);
    if (nearbyClickable) {
      console.log('Found nearby OpenAI clickable element, clicking it...');
      nearbyClickable.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const isEmptyAfterClick = input.getAttribute('contenteditable') === 'true' ? 
        input.textContent.trim() === '' : 
        input.value === '';
      
      if (isEmptyAfterClick) {
        console.log('OpenAI click submission successful');
        return true;
      }
    }
    
    console.log('All OpenAI alternative submission methods failed');
    return false;
  }

  findNearbyClickable(input) {
    console.log('=== findNearbyClickable ===');
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
      '[class*="icon-button"]',
      '[class*="button"]'
    ];
    
    for (const selector of clickableSelectors) {
      const elements = container.querySelectorAll(selector);
      for (const element of elements) {
        if (element.offsetParent !== null && !element.disabled) {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            console.log('Found nearby OpenAI clickable element:', selector, element);
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