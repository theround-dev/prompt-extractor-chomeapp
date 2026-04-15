document.addEventListener('DOMContentLoaded', function() {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const status = document.getElementById('status');
  const progress = document.getElementById('progress');
  const progressText = document.getElementById('progressText');
  const delayIndicator = document.getElementById('delayIndicator');
  const delayIndicatorText = document.getElementById('delayIndicatorText');
  
  // New elements for batch functionality
  const localPromptsRadio = document.getElementById('localPrompts');
  const automatedBatchRadio = document.getElementById('automatedBatch');
  const batchSelector = document.getElementById('batchSelector');
  const batchSelect = document.getElementById('batchSelect');
  const refreshBatchesBtn = document.getElementById('refreshBatches');
  const fetchBatchDataBtn = document.getElementById('fetchBatchData');
  const fetchBatchPromptStatusBtn = document.getElementById('fetchBatchPromptStatus');
  const batchLoading = document.getElementById('batchLoading');
  const delayExecutionEnabled = document.getElementById('delayExecutionEnabled');
  const delayProfileContainer = document.getElementById('delayProfileContainer');
  const delayProfileSelect = document.getElementById('delayProfileSelect');
  const skipPromptsEnabled = document.getElementById('skipPromptsEnabled');
  const skipPromptsContainer = document.getElementById('skipPromptsContainer');
  const skipPromptsSelect = document.getElementById('skipPromptsSelect');
  
  // API configuration
  const API_BASE_URL = 'https://hmwgplzdzffivawkflci.supabase.co/functions/v1/api';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtd2dwbHpkemZmaXZhd2tmbGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1MjQyNzYsImV4cCI6MjA2OTEwMDI3Nn0.D-kY79Vdqat9QNIMrJLS0w0dlp3182GIOvXg0GkoxtY';
  
  // Check current status
  updateStatus();
  
  // Load saved settings
  loadSavedSettings();
  
  // Radio button change handlers
  localPromptsRadio.addEventListener('change', function() {
    if (this.checked) {
      batchSelector.style.display = 'none';
      savePromptSource('local');
    }
  });
  
  automatedBatchRadio.addEventListener('change', function() {
    if (this.checked) {
      batchSelector.style.display = 'block';
      savePromptSource('batch');
      loadBatches();
    }
  });
  
  // Batch selection change handler
  batchSelect.addEventListener('change', function() {
    const selectedBatchId = this.value;
    if (selectedBatchId) {
      saveSelectedBatch(selectedBatchId);
      status.textContent = `Batch selected: ${this.options[this.selectedIndex].text}`;
      status.className = 'status running';
    } else {
      chrome.storage.local.remove(['selectedBatchId', 'selectedBatchName']);
      status.textContent = 'Ready to start';
      status.className = 'status stopped';
    }
  });
  
  // Refresh batches button
  refreshBatchesBtn.addEventListener('click', function() {
    loadBatches();
  });

  // Optional batch fetch buttons (guarded to avoid popup init crashes if markup changes).
  if (fetchBatchDataBtn) {
    fetchBatchDataBtn.addEventListener('click', function() {
      fetchBatchPromptStatus();
    });
  }

  if (fetchBatchPromptStatusBtn) {
    fetchBatchPromptStatusBtn.addEventListener('click', function() {
      fetchBatchPromptStatus();
    });
  }

  delayExecutionEnabled.addEventListener('change', function() {
    updateDelayProfileVisibility(this.checked);
    saveDelaySettings(this.checked, delayProfileSelect.value);
  });

  delayProfileSelect.addEventListener('change', function() {
    saveDelaySettings(delayExecutionEnabled.checked, this.value);
  });

  skipPromptsEnabled.addEventListener('change', function() {
    updateSkipPromptsVisibility(this.checked);
    saveSkipPromptsSettings(this.checked, skipPromptsSelect.value);
  });

  skipPromptsSelect.addEventListener('change', function() {
    saveSkipPromptsSettings(skipPromptsEnabled.checked, this.value);
  });
  
  // Start button click
  startBtn.addEventListener('click', function() {
    console.log('Starting automation...');
    const promptSource = document.querySelector('input[name="promptSource"]:checked').value;
    
    if (promptSource === 'batch' && !batchSelect.value) {
      status.textContent = 'Please select a batch first';
      status.className = 'status stopped';
      return;
    }
    
    // Show loading state
    status.textContent = 'Starting automation...';
    status.className = 'status running';
    startBtn.disabled = true;
    
    chrome.runtime.sendMessage({ 
      type: 'startAutomation',
      promptSource: promptSource,
      batchId: promptSource === 'batch' ? batchSelect.value : null,
      delayExecutionEnabled: delayExecutionEnabled.checked,
      delayProfile: delayProfileSelect.value,
      skipPromptsEnabled: skipPromptsEnabled.checked,
      skipPromptsCount: Number(skipPromptsSelect.value || 0)
    }, function(response) {
      if (response && response.success) {
        updateStatus();
      } else {
        status.textContent = 'Failed to start automation: ' + (response?.error || 'Unknown error');
        status.className = 'status stopped';
        startBtn.disabled = false;
      }
    });
  });
  
  // Stop button click
  stopBtn.addEventListener('click', function() {
    // Show stopping state
    status.textContent = 'Stopping automation...';
    status.className = 'status running';
    stopBtn.disabled = true;
    
    chrome.runtime.sendMessage({ type: 'stopAutomation' }, function(response) {
      if (response && response.success) {
        status.textContent = 'Automation stopped';
        status.className = 'status stopped';
        setTimeout(() => {
          updateStatus();
        }, 1000);
      } else {
        status.textContent = 'Failed to stop automation: ' + (response?.error || 'Unknown error');
        status.className = 'status stopped';
        stopBtn.disabled = false;
        setTimeout(() => {
          updateStatus();
        }, 3000);
      }
    });
  });
  
  // Download button click
  downloadBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({ type: 'downloadResponses' }, function(response) {
      if (response && response.success) {
        status.textContent = 'Download started successfully';
        status.className = 'status running';
        setTimeout(() => {
          updateStatus();
        }, 2000);
      } else {
        status.textContent = 'Download failed: ' + (response?.error || 'Unknown error');
        status.className = 'status stopped';
        setTimeout(() => {
          updateStatus();
        }, 3000);
      }
    });
  });
  
  async function loadBatches() {
    try {
      batchLoading.style.display = 'block';
      batchSelect.disabled = true;
      status.textContent = 'Loading batches...';
      status.className = 'status running';
      
      console.log('Making API request to:', `${API_BASE_URL}/batches`);
      console.log('Using anon key:', anonKey.substring(0, 20) + '...');
      
      const response = await fetch(`${API_BASE_URL}/batches`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
          'x-client-info': 'supabase-js/2.0.0'
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.success && data.data) {
        // Clear existing options except the first one
        batchSelect.innerHTML = '<option value="">Select a batch...</option>';
        
        // Add batch options
        data.data.forEach(batch => {
          const option = document.createElement('option');
          option.value = batch.id;
          const date = new Date(batch.started_at).toLocaleDateString();
          const brandName = batch.brand?.name || 'Unknown Brand';
          const batchName = batch.name || 'Unnamed Batch';
          option.textContent = `${brandName} | ${batchName} | ${date}`;
          batchSelect.appendChild(option);
        });
        
        // Restore previously selected batch if it exists
        chrome.storage.local.get(['selectedBatchId'], function(result) {
          if (result.selectedBatchId) {
            batchSelect.value = result.selectedBatchId;
            // Trigger change event to update status
            batchSelect.dispatchEvent(new Event('change'));
          } else {
            status.textContent = 'Batches loaded. Please select one.';
            status.className = 'status stopped';
          }
        });
        
        if (data.data.length === 0) {
          status.textContent = 'No batches available';
          status.className = 'status stopped';
        }
        
      } else {
        throw new Error(data.error || 'Failed to load batches');
      }
      
    } catch (error) {
      console.error('Error loading batches:', error);
      status.textContent = 'Failed to load batches: ' + error.message;
      status.className = 'status stopped';
      
      // Add error option to dropdown
      batchSelect.innerHTML = '<option value="">Error loading batches</option>';
    } finally {
      batchLoading.style.display = 'none';
      batchSelect.disabled = false;
    }
  }
  
  function loadSavedSettings() {
    chrome.storage.local.get([
      'promptSource',
      'selectedBatchId',
      'delayExecutionEnabled',
      'delayProfile',
      'skipPromptsEnabled',
      'skipPromptsCount'
    ], function(result) {
      if (result.promptSource === 'batch') {
        automatedBatchRadio.checked = true;
        localPromptsRadio.checked = false;
        batchSelector.style.display = 'block';
        // Only load batches if we have a saved batch ID
        if (result.selectedBatchId) {
          loadBatches();
        } else {
          status.textContent = 'Please select a batch';
          status.className = 'status stopped';
        }
      } else {
        localPromptsRadio.checked = true;
        automatedBatchRadio.checked = false;
        batchSelector.style.display = 'none';
      }

      const isDelayEnabled = Boolean(result.delayExecutionEnabled);
      const profile = result.delayProfile || 'balanced';
      delayExecutionEnabled.checked = isDelayEnabled;
      delayProfileSelect.value = profile;
      updateDelayProfileVisibility(isDelayEnabled);

      const isSkipPromptsEnabled = Boolean(result.skipPromptsEnabled);
      const skipCount = Number.isFinite(Number(result.skipPromptsCount))
        ? Number(result.skipPromptsCount)
        : 0;
      skipPromptsEnabled.checked = isSkipPromptsEnabled;
      skipPromptsSelect.value = String(skipCount);
      updateSkipPromptsVisibility(isSkipPromptsEnabled);
    });
  }
  
  function savePromptSource(source) {
    chrome.storage.local.set({ promptSource: source });
  }
  
  function saveSelectedBatch(batchId) {
    const batchName = batchSelect.options[batchSelect.selectedIndex].text;
    chrome.storage.local.set({ 
      selectedBatchId: batchId,
      selectedBatchName: batchName
    });
  }

  function updateDelayProfileVisibility(isEnabled) {
    delayProfileContainer.style.display = isEnabled ? 'block' : 'none';
  }

  function saveDelaySettings(enabled, profile) {
    chrome.storage.local.set({
      delayExecutionEnabled: Boolean(enabled),
      delayProfile: profile || 'balanced'
    });
  }

  function updateSkipPromptsVisibility(isEnabled) {
    skipPromptsContainer.style.display = isEnabled ? 'block' : 'none';
  }

  function saveSkipPromptsSettings(enabled, count) {
    chrome.storage.local.set({
      skipPromptsEnabled: Boolean(enabled),
      skipPromptsCount: Number(count) || 0
    });
  }

  function fetchBatchPromptStatus() {
    const selectedBatchId = batchSelect.value;
    if (!selectedBatchId) {
      status.textContent = 'Please select a batch first';
      status.className = 'status stopped';
      progress.style.display = 'none';
      return;
    }

    status.textContent = 'Fetching batch prompt data...';
    status.className = 'status running';

    chrome.runtime.sendMessage({
      type: 'fetchBatchPromptStatus',
      batchId: selectedBatchId
    }, function(response) {
      if (response && response.success) {
        status.textContent = `Batch loaded: ${response.totalPrompts} prompts`;
        status.className = 'status running';
        progress.style.display = 'block';
        progressText.textContent = `Prompts left: ${response.promptsLeft}`;
      } else {
        status.textContent = 'Failed to fetch batch data: ' + (response?.error || 'Unknown error');
        status.className = 'status stopped';
        progress.style.display = 'none';
      }
    });
  }
  
  function updateStatus() {
    chrome.runtime.sendMessage({ type: 'getStatus' }, function(response) {
      if (response && response.isRunning) {
        const siteName = response.currentSite === 'openai' ? 'OpenAI' : 'DeepSeek';
        status.textContent = `Automation running on ${siteName}...`;
        status.className = 'status running';
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        stopBtn.disabled = false; // Re-enable stop button
        
        if (response.currentPromptIndex !== undefined && response.totalPrompts) {
          progress.style.display = 'block';
          progressText.textContent = `Processing: ${response.currentPromptIndex + 1}/${response.totalPrompts}`;
        }

        updateDelayIndicator(response);
      } else {
        status.textContent = 'Ready to start';
        status.className = 'status stopped';
        startBtn.style.display = 'block';
        stopBtn.style.display = 'none';
        startBtn.disabled = false;
        stopBtn.disabled = false; // Reset stop button state
        if (response?.promptSource === 'batch' && Number(response?.totalPrompts) > 0) {
          const promptsLeft = Math.max(Number(response.totalPrompts) - Number(response.currentPromptIndex || 0), 0);
          progress.style.display = 'block';
          progressText.textContent = `Prompts left: ${promptsLeft}`;
        } else {
          progress.style.display = 'none';
        }
        delayIndicator.style.display = 'none';
      }
    });
  }

  function updateDelayIndicator(response) {
    const delayEnabled = Boolean(response.automationConfig?.delayExecutionEnabled);
    const msRemaining = response.msUntilNextPrompt;
    if (!delayEnabled || msRemaining === null || msRemaining === undefined) {
      delayIndicator.style.display = 'none';
      return;
    }

    const seconds = Math.ceil(msRemaining / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const timeLabel = minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
    const reason = response.nextPromptDelayReason ? ` (${response.nextPromptDelayReason})` : '';

    delayIndicatorText.textContent = `Delay Execution active: next prompt in ${timeLabel}${reason}`;
    delayIndicator.style.display = 'flex';
  }
  
  // Update status every second when running for smoother countdown
  setInterval(function() {
    chrome.runtime.sendMessage({ type: 'getStatus' }, function(response) {
      if (response && response.isRunning) {
        updateStatus();
      }
    });
  }, 1000);
}); 