document.addEventListener('DOMContentLoaded', function() {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const status = document.getElementById('status');
  const progress = document.getElementById('progress');
  const progressText = document.getElementById('progressText');
  
  // Check current status
  updateStatus();
  
  // Start button click
  startBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({ type: 'startAutomation' }, function(response) {
      if (response && response.success) {
        updateStatus();
      } else {
        status.textContent = 'Failed to start automation';
        status.className = 'status stopped';
      }
    });
  });
  
  // Stop button click
  stopBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({ type: 'stopAutomation' }, function(response) {
      updateStatus();
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
  
  function updateStatus() {
    chrome.runtime.sendMessage({ type: 'getStatus' }, function(response) {
      if (response && response.isRunning) {
        const siteName = response.currentSite === 'openai' ? 'OpenAI' : 'DeepSeek';
        status.textContent = `Automation running on ${siteName}...`;
        status.className = 'status running';
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        
        if (response.currentPromptIndex !== undefined && response.totalPrompts) {
          progress.style.display = 'block';
          progressText.textContent = `Processing: ${response.currentPromptIndex + 1}/${response.totalPrompts}`;
        }
      } else {
        status.textContent = 'Ready to start';
        status.className = 'status stopped';
        startBtn.style.display = 'block';
        stopBtn.style.display = 'none';
        progress.style.display = 'none';
      }
    });
  }
  
  // Update status every 2 seconds when running
  setInterval(function() {
    chrome.runtime.sendMessage({ type: 'getStatus' }, function(response) {
      if (response && response.isRunning) {
        updateStatus();
      }
    });
  }, 2000);
}); 