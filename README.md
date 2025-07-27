# AI Chat Automator

A Chrome extension that automates prompt submission and response collection for both DeepSeek Chat and OpenAI Chat.

## Features

- **Multi-site Support**: Works with both [DeepSeek Chat](https://chat.deepseek.com) and [OpenAI Chat](https://chatgpt.com)
- **Automatic Site Detection**: Automatically detects which site you're on and uses the appropriate handler
- **Flexible Prompt Sources**: 
  - **Local Prompts**: Use prompts from local `prompts.json` file
  - **Automated Batches**: Fetch prompts from Supabase API batches
- **Batch Processing**: Processes multiple prompts from your chosen source
- **Response Collection**: Saves all responses with timestamps and site information
- **Real-time Progress**: Shows progress in the popup interface
- **Export Functionality**: Downloads responses as JSON files
- **Persistent Settings**: Remembers your prompt source and batch selection

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension icon should appear in your toolbar

## Usage

### Setup

1. **Choose Prompt Source**:
   - **Local Prompts**: Edit `prompts.json` to include your prompts:
     ```json
     [
       {
         "id": "uuid",
         "text": "What is the capital of France?",
         "category": "Geography",
         "tags": ["location", "capital"],
         "brand_id": "brand-uuid"
       }
     ]
     ```
   - **Automated Batches**: Select "Automated Batch" in the popup and choose from available batches

2. **Choose Your Site**: 
   - Navigate to either [chat.deepseek.com](https://chat.deepseek.com) or [chatgpt.com](https://chatgpt.com)
   - The extension will automatically detect which site you're on

### Running Automation

1. **Select Prompt Source**: 
   - Choose "Local Prompts" to use your `prompts.json` file
   - Choose "Automated Batch" and select a batch from the dropdown
2. **Start Automation**: Click the extension icon and click "Start Automation"
3. **Monitor Progress**: The popup will show current progress and site information
4. **Collect Results**: When complete, responses will be automatically downloaded as a JSON file

### Response Format

Responses are saved with the following structure:
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "totalPrompts": 3,
  "site": "deepseek",
  "promptSource": "local",
  "batchId": "batch-uuid",
  "responses": [
    {
      "prompt": "What is the capital of France?",
      "response": "The capital of France is Paris...",
      "site": "deepseek",
      "timestamp": "2024-01-30T10:30:05.000Z",
      "promptId": "prompt-uuid",
      "category": "Geography",
      "tags": ["location", "capital"],
      "brandId": "brand-uuid",
      "brandName": "Brand Name",
      "brandDescription": "Brand Description",
      "batchId": "batch-uuid"
    }
  ]
}
```

## File Structure

```
chromeApp/
├── manifest.json          # Extension configuration
├── background.js          # Background service worker
├── content.js             # Main content script (site-agnostic)
├── deepseek.js            # DeepSeek-specific implementation
├── openai.js              # OpenAI-specific implementation
├── popup.html             # Extension popup interface
├── popup.js               # Popup functionality
├── prompts.json           # Your prompts configuration
├── icon.svg               # Extension icon
└── README.md              # This file
```

## Site-Specific Features

### DeepSeek Chat
- Handles DeepSeek's specific UI elements and selectors
- Supports DeepSeek's markdown rendering
- Optimized for DeepSeek's response streaming

### OpenAI Chat
- Handles OpenAI's specific UI elements and selectors
- Supports OpenAI's conversation structure
- Optimized for OpenAI's response patterns

## Technical Details

### API Integration
The extension integrates with a Supabase Edge Function API for batch management:
- **Endpoint**: `https://hmwgplzdzffivawkflci.supabase.co/functions/v1/api`
- **Batches Endpoint**: `POST /batches` - Retrieves all available batches
- **Prompts Endpoint**: `POST /prompts` - Retrieves prompts filtered by brand_id
- **Authentication**: Uses Supabase anon key for API access

### Site Detection
The extension automatically detects which site you're on by checking the hostname:
- `chat.deepseek.com` → Uses DeepSeek handler
- `chatgpt.com` → Uses OpenAI handler

### Content Scripts
- `content.js`: Main logic that's site-agnostic
- `deepseek.js`: DeepSeek-specific selectors and handlers
- `openai.js`: OpenAI-specific selectors and handlers

### Response Detection
Each site handler includes specialized logic for:
- Finding input fields
- Locating submit buttons
- Detecting response completion
- Handling streaming responses

## Troubleshooting

### Common Issues

1. **Extension not working on a site**
   - Make sure you're on either chat.deepseek.com or chatgpt.com
   - Check the browser console for error messages
   - Try refreshing the page

2. **Responses not being captured**
   - Wait for the page to fully load before starting automation
   - Check that the site hasn't changed its UI structure
   - Look for console messages about response detection

3. **Submit button not found**
   - The extension tries multiple fallback methods
   - Check console logs for debugging information
   - Try manually submitting a message first

### Debug Information
Open the browser console (F12) to see detailed logging:
- Site detection messages
- Element search results
- Response detection status
- Error messages

## Development

### Adding Support for New Sites

To add support for a new AI chat site:

1. Create a new handler file (e.g., `newsite.js`)
2. Implement the required methods:
   - `findInputField()`
   - `findSubmitButton()`
   - `findChatContainer()`
   - `extractLatestResponse()`
   - `isResponseComplete()`
   - `tryAlternativeSubmission()`
   - `findNearbyClickable()`

3. Update `content.js` to include the new site detection
4. Update `manifest.json` to include the new content script
5. Update `background.js` to handle the new site

### Testing
- Test on both DeepSeek and OpenAI sites
- Verify response capture works correctly
- Check that the UI updates properly
- Ensure error handling works as expected

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests. 