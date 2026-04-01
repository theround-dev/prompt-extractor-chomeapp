let isRunning = false;
let currentPromptIndex = 0;
let prompts = [];
let responses = [];
let currentTabId = null;
let currentSite = null;
let currentBatchId = null;
let currentBrandId = null; // Add global variable to store brand_id
let promptSource = 'local'; // 'local' or 'batch'
let nextPromptTimeoutId = null; // Track the timeout for the next prompt

// Helper function to validate prompt has brand_id
function validatePromptBrandId(prompt, promptIndex) {
  if (!prompt || !prompt.brand_id) {
    console.log('validatePromptBrandId called with prompt:', prompt);
    console.error(`Prompt at index ${promptIndex} is missing brand_id:`, prompt);
    throw new Error(`Prompt at index ${promptIndex} is missing required brand_id field`);
  }
  return true;
}

// Helper function to validate API payload has brand_id
function validateApiPayloadBrandId(apiPayload, context = 'API payload') {
  if (!apiPayload || !apiPayload.brand_id) {
    console.error(`Missing brand_id in ${context}:`, apiPayload);
    console.error('Current global brand_id:', currentBrandId);
    throw new Error(`Missing required brand_id field in ${context}`);
  }
  return true;
}

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
    console.log('First prompt structure:', prompts[0]);
    
    // Log all prompts that will be run
    console.log('=== PROMPTS TO BE RUN (LOCAL) ===');
    console.log(`Total prompts: ${prompts.length}`);
    console.log(`prompts`,prompts);
    // prompts.forEach((prompt, index) => {
    //   console.log(`Prompt ${index + 1}/${prompts.length}:`);
    //   console.log(`  ID: ${prompt.id}`);
    //   console.log(`  Text: ${prompt.text}`);
    //   console.log(`  Category: ${prompt.category}`);
    //   console.log(`  Tags: ${prompt.tags}`);
    //   console.log(`  Brand ID: ${prompt.brand_id}`);
    //   console.log(`  Approved: ${prompt.approved}`);
    //   console.log(`  Active: ${prompt.active}`);
    //   console.log(`  Created: ${prompt.created_at}`);
    //   console.log('  ---');
    // });
    console.log('=== END PROMPTS LOG ===');
    
    // Extract brand_id from the first prompt for local prompts
    if (prompts.length > 0 && prompts[0].brand_id) {
      currentBrandId = prompts[0].brand_id;
      console.log('Local prompts brand_id set to:', currentBrandId);
    }
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
    const brandId = batch.config?.brand_id || batch.config?.brand || batch.batch_metadata?.brand_id;
    
    console.log('Batch config:', batch.config);
    console.log('Extracted brand_id:', brandId);
    
    if (!brandId) {
      throw new Error('No brand_id found in batch configuration');
    }
    
    currentBrandId = brandId; // Store brand_id globally
    console.log('Global brand_id set to:', currentBrandId);
    
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
        batch_id: batchId,
        brand_id: brandId,
        limit: 1000 // Get all prompts for the brand
      })
    });
    
    if (!promptsResponse.ok) {
      throw new Error(`HTTP error! status: ${promptsResponse.status}`);
    }
    
    const promptsData = await promptsResponse.json();
    
    if (promptsData.success && promptsData.data && promptsData.data.prompts) {
      // Enhance prompts with batch_id and brand_id
      prompts = promptsData.data.prompts.map(prompt => ({
        ...prompt,
        batch_id: batchId,
        brand_id: brandId
      }));
      
      console.log('Batch prompts loaded:', prompts.length);
      console.log('First batch prompt structure:', prompts[0]);
      console.log('First batch prompt brand_id:', prompts[0]?.brand_id);
      
      // Log all prompts that will be run
      console.log('=== PROMPTS TO BE RUN (BATCH) ===');
      console.log(`Total prompts: ${prompts.length}`);
      console.log(`Batch ID: ${batchId}`);
      console.log(`Brand ID: ${brandId}`);
      console.log(`prompts`,prompts);
      // prompts.forEach((prompt, index) => {
      //   console.log(`Prompt ${index + 1}/${prompts.length}:`);
      //   console.log(`  ID: ${prompt.id}`);
      //   console.log(`  Text: ${prompt.text}`);
      //   console.log(`  Category: ${prompt.category}`);
      //   console.log(`  Tags: ${prompt.tags}`);
      //   console.log(`  Brand ID: ${prompt.brand_id}`);
      //   console.log(`  Approved: ${prompt.approved}`);
      //   console.log(`  Active: ${prompt.active}`);
      //   console.log(`  Created: ${prompt.created_at}`);
      //   console.log('  ---');
      // });
      console.log('=== END PROMPTS LOG ===');
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
    // Create consistent data structure matching API payload
    const responseData = {
      prompt_id: request.promptId,
      brand_id: request.brandId || currentBrandId, // Use prompt's brandId if available, fallback to global
      response: request.response,
      batch_id: currentBatchId,
      llm_model: currentSite === 'openai' ? 'gpt-4' : 'deepseek-chat',
      config: {
        site: request.site || 'Unknown',
        category: request.category,
        tags: request.tags,
        measurements: request.measurements
      },
      output_metadata: {
        brand_name: request.brandName,
        brand_description: request.brandDescription,
        approved: request.approved,
        active: request.active,
        created_at: request.createdAt,
        original_metadata: request.metadata,
        site_used: request.site || 'Unknown',
        timestamp: new Date().toISOString(),
        conversation_search_data: request.conversationData || null
      },
      version_info: {
        app_type: "chrome_extension",
        app_version: "1.0.0",
        extension_version: chrome.runtime.getManifest().version,
        prompt_source: promptSource
      },
      // Keep original prompt for reference (not sent to API)
      original_prompt: request.prompt
    };
    
    // Debug logging to see what's being received
    console.log('Received saveResponse request:', request);
    console.log('Current brand_id:', currentBrandId);
    console.log('Constructed responseData:', responseData);
    
    responses.push(responseData);
    
    // Save to local storage
    chrome.storage.local.set({ responses }, () => {
      console.log('Response saved, total:', responses.length);
    });
    
    // Save to API endpoint
    savePromptOutputToAPI(responseData);
    
    // Continue with next prompt only if still running
    currentPromptIndex++;
    if (currentPromptIndex < prompts.length && isRunning) {
      // Helper function to send next valid prompt
      const sendNextValidPrompt = () => {
        if (!isRunning) return;
        
        // Find next prompt with valid brand_id
        while (currentPromptIndex < prompts.length) {
          try {
            validatePromptBrandId(prompts[currentPromptIndex], currentPromptIndex);
            // If we get here, the prompt is valid
            console.log('Sending next prompt to content script:', prompts[currentPromptIndex]);
            console.log('Next prompt brand_id:', prompts[currentPromptIndex]?.brand_id);
            chrome.tabs.sendMessage(sender.tab.id, {
              type: "nextPrompt",
              prompt: prompts[currentPromptIndex]
            });
            return; // Exit the function
          } catch (error) {
            console.error('Skipping prompt due to missing brand_id:', error.message);
            currentPromptIndex++;
          }
        }
        
        // If we get here, no more valid prompts
        if (currentPromptIndex >= prompts.length) {
          isRunning = false;
          console.log('All prompts completed (some were skipped due to missing brand_id)');
          try {
            saveResponsesToFile();
          } catch (saveError) {
            console.error('Failed to save responses to file:', saveError);
            chrome.storage.local.set({ 
              responses: responses,
              completed_timestamp: new Date().toISOString()
            });
          }
        }
      };
      
      nextPromptTimeoutId = setTimeout(sendNextValidPrompt, 3000); // Wait 3 seconds between prompts
    } else {
      if (currentPromptIndex >= prompts.length) {
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
    }
  } else if (request.type === "skipPrompt") {
    console.log('Skipping prompt (response matched prompt):', request.reason);
    // Do not save - advance to next prompt
    currentPromptIndex++;
    if (currentPromptIndex < prompts.length && isRunning) {
      const sendNextValidPrompt = () => {
        if (!isRunning) return;
        while (currentPromptIndex < prompts.length) {
          try {
            validatePromptBrandId(prompts[currentPromptIndex], currentPromptIndex);
            console.log('Sending next prompt to content script:', prompts[currentPromptIndex]);
            chrome.tabs.sendMessage(sender.tab.id, {
              type: "nextPrompt",
              prompt: prompts[currentPromptIndex]
            });
            return;
          } catch (error) {
            console.error('Skipping prompt due to missing brand_id:', error.message);
            currentPromptIndex++;
          }
        }
        if (currentPromptIndex >= prompts.length) {
          isRunning = false;
          console.log('All prompts completed');
          try {
            saveResponsesToFile();
          } catch (saveError) {
            console.error('Failed to save responses to file:', saveError);
            chrome.storage.local.set({
              responses: responses,
              completed_timestamp: new Date().toISOString()
            });
          }
        }
      };
      nextPromptTimeoutId = setTimeout(sendNextValidPrompt, 3000);
    } else {
      if (currentPromptIndex >= prompts.length) {
        isRunning = false;
        console.log('All prompts completed');
        try {
          saveResponsesToFile();
        } catch (error) {
          console.error('Failed to save responses to file:', error);
          chrome.storage.local.set({
            responses: responses,
            completed_timestamp: new Date().toISOString()
          });
        }
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
    stopAutomation();
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
    currentBrandId = null; // Reset brand_id
    
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
    
    // Log automation summary
    console.log('=== AUTOMATION SUMMARY ===');
    console.log(`Prompt source: ${source}`);
    console.log(`Total prompts to process: ${prompts.length}`);
    console.log(`Batch ID: ${batchId || 'N/A (local prompts)'}`);
    console.log(`Brand ID: ${currentBrandId || 'Not set yet'}`);
    console.log('=== END AUTOMATION SUMMARY ===');
    
    // Ensure we have a brand_id
    if (!currentBrandId) {
      console.warn('No brand_id found, attempting to extract from first prompt...');
      if (prompts[0]?.brand_id) {
        currentBrandId = prompts[0].brand_id;
        console.log('Extracted brand_id from first prompt:', currentBrandId);
      } else {
        throw new Error('No brand_id available from batch or prompts');
      }
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
    
    // Validate first prompt has brand_id before sending
    console.log("FIRST PROMPT", prompts[currentPromptIndex]);
    validatePromptBrandId(prompts[currentPromptIndex], currentPromptIndex);
    
    // Start with first prompt
    console.log('Sending first prompt to content script:', prompts[currentPromptIndex]);
    console.log('First prompt brand_id:', prompts[currentPromptIndex]?.brand_id);
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
    
    // Generate filename with batch name, date, and randomized number
    const generateFilename = () => {
      const date = new Date().toISOString().split('T')[0];
      const randomNumber = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      
      if (promptSource === 'batch' && currentBatchId) {
        // Get batch name from storage
        return new Promise((resolve) => {
          chrome.storage.local.get(['selectedBatchName'], function(result) {
            let batchName = result.selectedBatchName || 'unknown_batch';
            
            // Clean the batch name for filename (remove special characters, limit length)
            batchName = batchName
              .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remove special characters except spaces, hyphens, underscores
              .replace(/\s+/g, '_') // Replace spaces with underscores
              .substring(0, 50); // Limit length
            
            const filename = `${batchName}_${date}_v2332_${randomNumber}.json`;
            resolve(filename);
          });
        });
      } else {
        // For local prompts, use a different format
        const filename = `local_prompts_${date}_v2332_${randomNumber}.json`;
        return Promise.resolve(filename);
      }
    };
    
    generateFilename().then(filename => {
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

async function savePromptOutputToAPI(responseData) {
  try {
    // Debug logging to see the responseData structure
    console.log('savePromptOutputToAPI called with responseData:', responseData);
    console.log('responseData.brand_id:', responseData.brand_id);
    console.log('responseData.prompt_id:', responseData.prompt_id);
    
    // Create API payload by removing the original_prompt field (not needed for API)
    const apiPayload = { ...responseData };
    delete apiPayload.original_prompt;

    console.log('Saving prompt output to API:', apiPayload);

    // Validate required fields before sending
    validateApiPayloadBrandId(apiPayload, 'API payload');

    const response = await fetch(`${API_BASE_URL}/prompt-outputs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'x-client-info': 'supabase-js/2.0.0'
      },
      body: JSON.stringify(apiPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('Prompt output saved successfully:', result.data);
    } else {
      throw new Error(result.error || 'Failed to save prompt output');
    }

  } catch (error) {
    console.error('Failed to save prompt output to API:', error);
    // Don't throw the error to avoid breaking the automation flow
    // The response is still saved locally
  }
}

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === currentTabId && changeInfo.status === 'complete') {
    console.log(`${currentSite} tab loaded`);
  }
});

function stopAutomation() {
  console.log('Stopping automation...');
  isRunning = false;
  
  // Clear any pending timeout for the next prompt
  if (nextPromptTimeoutId) {
    clearTimeout(nextPromptTimeoutId);
    nextPromptTimeoutId = null;
  }
  
  // Notify content script to stop processing
  if (currentTabId) {
    chrome.tabs.sendMessage(currentTabId, {
      type: "stopProcessing"
    }).catch(error => {
      console.log('Could not send stop message to content script:', error);
    });
  }
  
  console.log('Automation stopped');
}