let isRunning = false;
let currentPromptIndex = 0;
let prompts = [];
let responses = [];
let currentTabId = null;
let currentSite = null;
let currentBatchId = null;
let promptSource = 'local'; // 'local' or 'batch'

// API configuration
const API_BASE_URL = 'https://hmwgplzdzffivawkflci.supabase.co/functions/v1/api';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtd2dwbHpkemZmaXZhd2tmbGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1MjQyNzYsImV4cCI6MjA2OTEwMDI3Nn0.D-kY79Vdqat9QNIMrJLS0w0dlp3182GIOvXg0GkoxtY';

// Load prompts when extension starts
chrome.runtime.onInstalled.addListener(async () => {
  try {
    // Load saved settings
    chrome.storage.local.get(['promptSource', 'selectedBatchId'], async function(result) {
      promptSource = result.promptSource || 'local';
      currentBatchId = result.selectedBatchId;
      
      if (promptSource === 'local') {
        await loadLocalPrompts();
      } else if (promptSource === 'batch' && currentBatchId) {
        await loadBatchPrompts(currentBatchId);
      }
    });
  } catch (error) {
    console.error('Failed to load prompts:', error);
  }
});

async function loadLocalPrompts() {
  try {
    const result = await fetch(chrome.runtime.getURL('prompts.json'));
    prompts = await result.json();
    console.log('Local prompts loaded:', prompts.length);
  } catch (error) {
    console.error('Failed to load local prompts:', error);
    prompts = [];
  }
}

async function loadBatchPrompts(batchId) {
  try {
    console.log('Loading prompts for batch:', batchId);
    
    // First, we need to get the batch details to find the brand_id
    const batchResponse = await fetch(`${API_BASE_URL}/batches`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'x-client-info': 'supabase-js/2.0.0'
      }
    });
    
    if (!batchResponse.ok) {
      throw new Error(`HTTP error! status: ${batchResponse.status}`);
    }
    
    const batchData = await batchResponse.json();
    
    if (!batchData.success || !batchData.data) {
      throw new Error('Failed to load batch data');
    }
    
    // Find the specific batch
    const batch = batchData.data.find(b => b.id === batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }
    
    // Extract brand_id from batch config or metadata
    const brandId = batch.config?.brand_id || batch.batch_metadata?.brand_id;
    
    if (!brandId) {
      throw new Error('No brand_id found in batch configuration');
    }
    
    // Now get prompts for this brand
    const promptsResponse = await fetch(`${API_BASE_URL}/prompts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'x-client-info': 'supabase-js/2.0.0'
      },
      body: JSON.stringify({
        brand_id: brandId,
        limit: 1000 // Get all prompts for the brand
      })
    });
    
    if (!promptsResponse.ok) {
      throw new Error(`HTTP error! status: ${promptsResponse.status}`);
    }
    
    const promptsData = await promptsResponse.json();
    
    if (promptsData.success && promptsData.data && promptsData.data.prompts) {
      prompts = promptsData.data.prompts;
      console.log('Batch prompts loaded:', prompts.length);
    } else {
      throw new Error(promptsData.error || 'Failed to load batch prompts');
    }
    
  } catch (error) {
    console.error('Failed to load batch prompts:', error);
    prompts = [];
  }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.type);
  
  if (request.type === "saveResponse") {
    responses.push({
      prompt: request.prompt,
      response: request.response,
      site: request.site || 'Unknown',
      timestamp: new Date().toISOString(),
      promptId: request.promptId,
      category: request.category,
      tags: request.tags,
      measurements: request.measurements,
      brandId: request.brandId,
      brandName: request.brandName,
      brandDescription: request.brandDescription,
      approved: request.approved,
      active: request.active,
      createdAt: request.createdAt,
      metadata: request.metadata,
      batchId: currentBatchId // Add batch ID to response
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
      startAutomation(request.promptSource, request.batchId).then(() => {
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
      currentSite: currentSite,
      promptSource: promptSource,
      batchId: currentBatchId
    });
  } else if (request.type === "downloadResponses") {
    try {
      saveResponsesToFile();
      sendResponse({ success: true });
    } catch (error) {
      console.error('Failed to download responses:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
});

async function startAutomation(source = 'local', batchId = null) {
  try {
    isRunning = true;
    currentPromptIndex = 0;
    responses = [];
    promptSource = source;
    currentBatchId = batchId;
    
    // Load prompts based on source
    if (source === 'local') {
      await loadLocalPrompts();
    } else if (source === 'batch' && batchId) {
      await loadBatchPrompts(batchId);
    } else {
      throw new Error('Invalid prompt source or missing batch ID');
    }
    
    if (prompts.length === 0) {
      throw new Error('No prompts available');
    }
    
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
    throw error;
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
      promptSource: promptSource,
      batchId: currentBatchId,
      responses: responses
    };
    
    const jsonString = JSON.stringify(data, null, 2);
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);
    
    const sourceSuffix = promptSource === 'batch' ? `_batch_${currentBatchId}` : '_local';
    const filename = `${currentSite}_responses${sourceSuffix}_${new Date().toISOString().split('T')[0]}.json`;
    
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