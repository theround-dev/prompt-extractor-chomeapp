let isRunning = false;
let currentPromptIndex = 0;
let prompts = [];
let responses = [];
let currentTabId = null;
let currentSite = null;

// Load prompts when extension starts
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const result = await fetch(chrome.runtime.getURL('prompts.json'));
    prompts = await result.json();
    console.log('Prompts loaded:', prompts.length);
  } catch (error) {
    console.error('Failed to load prompts:', error);
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.type);
  
  if (request.type === "saveResponse") {
    responses.push({
      prompt: request.prompt,
      response: request.response,
      site: request.site || 'Unknown',
      timestamp: new Date().toISOString()
    });
    
    // Save to local storage
    chrome.storage.local.set({ responses }, () => {
      console.log('Response saved, total:', responses.length);
    });
    
    // Continue with next prompt
    currentPromptIndex++;
    if (currentPromptIndex < prompts.length) {
      setTimeout(() => {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: "nextPrompt",
          prompt: prompts[currentPromptIndex]
        });
      }, 3000); // Wait 3 seconds between prompts
    } else {
      isRunning = false;
      console.log('All prompts completed');
      // Save all responses to a file
      try {
        saveResponsesToFile();
      } catch (error) {
        console.error('Failed to save responses to file:', error);
        // Ensure responses are at least saved to storage
        chrome.storage.local.set({ 
          responses: responses,
          completed_timestamp: new Date().toISOString()
        });
      }
    }
  } else if (request.type === "error") {
    console.error('Content script error:', request.error);
    isRunning = false;
  } else if (request.type === "ready") {
    console.log('Content script ready');
    sendResponse({ status: "ready" });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (isRunning) {
    console.log('Already running, stopping...');
    isRunning = false;
    return;
  }
  
  await startAutomation();
});

// Handle popup messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "startAutomation") {
    if (!isRunning) {
      startAutomation().then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        console.error('Failed to start automation:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep message channel open for async response
    } else {
      sendResponse({ success: false, error: 'Already running' });
    }
  } else if (request.type === "stopAutomation") {
    isRunning = false;
    sendResponse({ success: true });
  } else if (request.type === "getStatus") {
    sendResponse({
      isRunning: isRunning,
      currentPromptIndex: currentPromptIndex,
      totalPrompts: prompts.length,
      responsesCount: responses.length,
      currentSite: currentSite
    });
  }
});

async function startAutomation() {
  try {
    isRunning = true;
    currentPromptIndex = 0;
    responses = [];
    
    // Detect which site to use based on current tab or preference
    const currentTab = await getCurrentTab();
    let targetSite = 'deepseek'; // Default
    
    if (currentTab && currentTab.url) {
      if (currentTab.url.includes('chatgpt.com')) {
        targetSite = 'openai';
      } else if (currentTab.url.includes('chat.deepseek.com')) {
        targetSite = 'deepseek';
      }
    }
    
    currentSite = targetSite;
    
    // Open target site or focus if already open
    let targetTab = await findTargetTab(targetSite);
    if (!targetTab) {
      const url = targetSite === 'openai' ? 'https://chatgpt.com' : 'https://chat.deepseek.com';
      targetTab = await chrome.tabs.create({ 
        url: url,
        active: true
      });
    } else {
      await chrome.tabs.update(targetTab.id, { active: true });
    }
    
    currentTabId = targetTab.id;
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if content script is ready
    try {
      await chrome.tabs.sendMessage(targetTab.id, { type: "ready" });
    } catch (error) {
      console.log('Content script not ready, injecting...');
      const files = targetSite === 'openai' ? ['openai.js', 'content.js'] : ['deepseek.js', 'content.js'];
      await chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        files: files
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Start with first prompt
    chrome.tabs.sendMessage(targetTab.id, {
      type: "nextPrompt",
      prompt: prompts[currentPromptIndex]
    });
    
  } catch (error) {
    console.error('Error starting automation:', error);
    isRunning = false;
  }
}

async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function findTargetTab(site) {
  const tabs = await chrome.tabs.query({});
  const url = site === 'openai' ? 'chatgpt.com' : 'chat.deepseek.com';
  return tabs.find(tab => tab.url && tab.url.includes(url));
}

function saveResponsesToFile() {
  try {
    const data = {
      timestamp: new Date().toISOString(),
      totalPrompts: prompts.length,
      site: currentSite,
      responses: responses
    };
    
    const jsonString = JSON.stringify(data, null, 2);
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);
    
    const filename = `${currentSite}_responses_${new Date().toISOString().split('T')[0]}.json`;
    
    chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Download failed:', chrome.runtime.lastError);
        // Fallback: save to storage
        chrome.storage.local.set({ 
          responses_backup: responses,
          backup_timestamp: new Date().toISOString()
        }, () => {
          console.log('Responses saved to storage as backup');
        });
      } else {
        console.log('Download started with ID:', downloadId);
      }
    });
  } catch (error) {
    console.error('Error saving responses to file:', error);
    // Fallback: try to save to storage
    chrome.storage.local.set({ 
      responses_backup: responses,
      backup_timestamp: new Date().toISOString()
    }, () => {
      console.log('Responses saved to storage as backup');
    });
  }
}

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === currentTabId && changeInfo.status === 'complete') {
    console.log(`${currentSite} tab loaded`);
  }
});