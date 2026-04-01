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
let nextPromptScheduledAt = null;
let nextPromptDelayReason = null;
let automationConfig = {
  delayExecutionEnabled: false,
  delayProfile: 'balanced'
};
let throttleStrikeCount = 0;
let throttleSignalUntil = 0;
let dynamicThrottleUntil = 0;
let rateLimitEvents = [];

const DELAY_PROFILES = {
  conservative: { minMs: 8000, maxMs: 45000, longPauseChance: 0.1, longMinMs: 60000, longMaxMs: 90000 },
  balanced: { minMs: 20000, maxMs: 90000, longPauseChance: 0.2, longMinMs: 120000, longMaxMs: 180000 },
  aggressive_humanlike: { minMs: 45000, maxMs: 180000, longPauseChance: 0.35, longMinMs: 180000, longMaxMs: 300000 }
};

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

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function parseRetryAfterSeconds(headerValue) {
  if (!headerValue) return null;
  const asNumber = Number(headerValue);
  if (!Number.isNaN(asNumber) && asNumber >= 0) {
    return asNumber;
  }
  const retryDate = Date.parse(headerValue);
  if (!Number.isNaN(retryDate)) {
    const diffSeconds = Math.ceil((retryDate - Date.now()) / 1000);
    return diffSeconds > 0 ? diffSeconds : 0;
  }
  return null;
}

function recordRateLimitEvent(source = 'unknown') {
  const now = Date.now();
  rateLimitEvents.push(now);
  rateLimitEvents = rateLimitEvents.filter(ts => now - ts <= 60000);
  throttleStrikeCount++;
  throttleSignalUntil = now + 5 * 60 * 1000;
  console.warn(`[rate-limit] event from ${source}; ${rateLimitEvents.length} events in last 60s`);
  if (rateLimitEvents.length >= 3) {
    dynamicThrottleUntil = Math.max(dynamicThrottleUntil, now + 5 * 60 * 1000);
    console.warn('[rate-limit] 3+ events in 60s, enabling 50% rate reduction window');
  }
}

function computeBackoffDelayMs(retries, retryAfterSeconds = null) {
  if (retryAfterSeconds !== null && retryAfterSeconds !== undefined) {
    return Math.min(60000, Math.max(0, retryAfterSeconds * 1000));
  }
  const baseDelay = Math.min(60000, 1000 * (2 ** retries));
  const jittered = Math.floor(baseDelay * (0.5 + Math.random()));
  return Math.min(60000, Math.max(1000, jittered));
}

function computeNextDelayMs() {
  if (!automationConfig.delayExecutionEnabled) {
    return { delayMs: 3000, reason: 'fixed_default' };
  }

  const profile = DELAY_PROFILES[automationConfig.delayProfile] || DELAY_PROFILES.balanced;
  let delayMs = randomBetween(profile.minMs, profile.maxMs);
  let reason = 'base+jitter';

  if (Math.random() < profile.longPauseChance) {
    delayMs = randomBetween(profile.longMinMs, profile.longMaxMs);
    reason = 'long_pause';
  }

  const now = Date.now();
  if (now < throttleSignalUntil) {
    const multiplier = Math.min(2.5, 1 + throttleStrikeCount * 0.15);
    delayMs = Math.floor(delayMs * multiplier);
    reason += '+throttle_backoff';
  }

  if (now < dynamicThrottleUntil) {
    delayMs = Math.max(delayMs, profile.minMs * 2);
    reason += '+dynamic_50pct_rate';
  }

  return { delayMs, reason };
}

function sendNextValidPrompt(tabId) {
  if (!isRunning) return;
  nextPromptScheduledAt = null;
  nextPromptDelayReason = null;

  while (currentPromptIndex < prompts.length) {
    try {
      validatePromptBrandId(prompts[currentPromptIndex], currentPromptIndex);
      const promptToSend = prompts[currentPromptIndex];
      console.log('Sending next prompt to content script:', promptToSend);
      chrome.tabs.sendMessage(tabId, {
        type: "nextPrompt",
        prompt: promptToSend,
        automationConfig
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
}

function scheduleNextPrompt(tabId) {
  if (!(currentPromptIndex < prompts.length && isRunning)) {
    if (currentPromptIndex >= prompts.length) {
      isRunning = false;
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
    return;
  }

  const { delayMs, reason } = computeNextDelayMs();
  console.log(`[delay] waiting ${delayMs}ms before next prompt (${reason})`);
  nextPromptScheduledAt = Date.now() + delayMs;
  nextPromptDelayReason = reason;
  nextPromptTimeoutId = setTimeout(() => sendNextValidPrompt(tabId), delayMs);
}

// API configuration
const API_BASE_URL = 'https://hmwgplzdzffivawkflci.supabase.co/functions/v1/api';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtd2dwbHpkemZmaXZhd2tmbGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1MjQyNzYsImV4cCI6MjA2OTEwMDI3Nn0.D-kY79Vdqat9QNIMrJLS0w0dlp3182GIOvXg0GkoxtY';

// Load prompts when extension starts
chrome.runtime.onInstalled.addListener(async () => {
  try {
    // Load saved settings
    chrome.storage.local.get(['promptSource', 'selectedBatchId', 'delayExecutionEnabled', 'delayProfile'], async function(result) {
      promptSource = result.promptSource || 'local';
      currentBatchId = result.selectedBatchId;
      automationConfig.delayExecutionEnabled = Boolean(result.delayExecutionEnabled);
      automationConfig.delayProfile = result.delayProfile || 'balanced';
      
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
        timestamp: new Date().toISOString()
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
    savePromptOutputToAPI(responseData).catch(error => {
      console.error('API save flow failed:', error);
    });
    
    // Continue with next prompt only if still running
    currentPromptIndex++;
    scheduleNextPrompt(sender.tab.id);
  } else if (request.type === "skipPrompt") {
    console.log('Skipping prompt (response matched prompt):', request.reason);
    // Do not save - advance to next prompt
    currentPromptIndex++;
    scheduleNextPrompt(sender.tab.id);
  } else if (request.type === "throttleDetected") {
    console.warn('Throttle signal received from content script:', request);
    recordRateLimitEvent('content_modal');
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
      startAutomation(request.promptSource, request.batchId, {
        delayExecutionEnabled: request.delayExecutionEnabled,
        delayProfile: request.delayProfile
      }).then(() => {
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
    const now = Date.now();
    const msUntilNextPrompt = nextPromptScheduledAt ? Math.max(0, nextPromptScheduledAt - now) : null;
    sendResponse({
      isRunning: isRunning,
      currentPromptIndex: currentPromptIndex,
      totalPrompts: prompts.length,
      responsesCount: responses.length,
      currentSite: currentSite,
      promptSource: promptSource,
      batchId: currentBatchId,
      automationConfig: automationConfig,
      healthState: now < dynamicThrottleUntil ? 'cooldown' : (now < throttleSignalUntil ? 'slowed' : 'normal'),
      nextPromptScheduledAt: nextPromptScheduledAt,
      nextPromptDelayReason: nextPromptDelayReason,
      msUntilNextPrompt: msUntilNextPrompt
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

async function startAutomation(source = 'local', batchId = null, config = {}) {
  try {
    isRunning = true;
    currentPromptIndex = 0;
    responses = [];
    promptSource = source;
    currentBatchId = batchId;
    currentBrandId = null; // Reset brand_id
    throttleStrikeCount = 0;
    throttleSignalUntil = 0;
    dynamicThrottleUntil = 0;
    rateLimitEvents = [];
    automationConfig = {
      delayExecutionEnabled: Boolean(
        config.delayExecutionEnabled !== undefined
          ? config.delayExecutionEnabled
          : automationConfig.delayExecutionEnabled
      ),
      delayProfile: config.delayProfile || automationConfig.delayProfile || 'balanced'
    };
    chrome.storage.local.set({
      delayExecutionEnabled: automationConfig.delayExecutionEnabled,
      delayProfile: automationConfig.delayProfile
    });
    
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
      prompt: prompts[currentPromptIndex],
      automationConfig
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

  const maxRetries = 4;

  for (let retries = 0; retries <= maxRetries; retries++) {
    try {
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

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSeconds = parseRetryAfterSeconds(retryAfterHeader);
        recordRateLimitEvent('api_429');
        console.warn(`[api] 429 received. Retry-After: ${retryAfterHeader || 'none'}`);

        if (retries >= maxRetries) {
          const bodyText = await response.text();
          console.error('[api] max retries reached after 429:', bodyText);
          return;
        }

        const waitMs = computeBackoffDelayMs(retries, retryAfterSeconds);
        console.warn(`[api] waiting ${waitMs}ms before retry ${retries + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status >= 500 && retries < maxRetries) {
          const waitMs = computeBackoffDelayMs(retries);
          console.warn(`[api] transient ${response.status}, retry in ${waitMs}ms`);
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue;
        }
        if (response.status >= 400 && response.status < 500) {
          console.error(`Failed to save prompt output to API: non-retriable ${response.status} - ${errorText}`);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const result = await response.json();
      if (result.success) {
        console.log('Prompt output saved successfully:', result.data);
        return;
      }

      if (retries >= maxRetries) {
        console.error('Failed to save prompt output after retries:', result.error || 'Unknown API error');
        return;
      }

      const waitMs = computeBackoffDelayMs(retries);
      console.warn(`[api] unsuccessful API response, retrying in ${waitMs}ms`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    } catch (error) {
      if (retries >= maxRetries) {
        console.error('Failed to save prompt output to API:', error);
        return;
      }
      const waitMs = computeBackoffDelayMs(retries);
      console.warn(`[api] network/error retry in ${waitMs}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
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
  nextPromptScheduledAt = null;
  nextPromptDelayReason = null;
  
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