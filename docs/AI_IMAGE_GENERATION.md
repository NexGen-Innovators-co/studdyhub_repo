# AI Image Generation Integration

## Overview
The AI Chat now supports image generation using Google's Gemini (Imagen) API. Users can generate high-quality images directly from text descriptions within the chat interface.

## Features

### 1. **Image Generator Modal**
- Beautiful, user-friendly modal interface
- Real-time image generation with loading states
- Image preview with zoom capabilities
- Download generated images
- Copy image URLs to clipboard
- Send images directly to chat

### 2. **Multiple Access Methods**

#### Method 1: Menu Button
- Click the menu icon (☰) in the chat input area
- Select "Generate AI Image" from the menu
- Enter your image description
- Click "Generate Image"

#### Method 2: Text Commands
Users can type special commands directly in the chat input to trigger image generation:
- `/image [description]` - Example: `/image a sunset over mountains`
- `generate image [description]` - Example: `generate image a futuristic city`
- `create image [description]` - Example: `create image a cute cat`
- `make image [description]` - Example: `make image a space station`
- `draw image [description]` - Example: `draw image a fantasy castle`

#### Method 3: Natural Language
The system also detects natural language requests:
- "Can you generate an image of [description]"
- "I want to see an image of [description]"
- "Show me an image of [description]"
- "Could you create an image showing [description]"

### 3. **Image Attachment to Messages**
- Generated images are automatically converted to file attachments
- Images appear in the context badges area
- Can be sent along with text messages
- The generation prompt is optionally added to the message

### 4. **User Experience Features**
- Auto-generation when using text commands
- Loading animations and progress indicators
- Error handling with user-friendly messages
- Keyboard shortcuts (Enter to generate)
- Responsive design for mobile and desktop
- Dark mode support

## Technical Implementation

### Files Created/Modified

#### New Files:
1. **`src/services/imageGenerationService.ts`**
   - Service layer for image generation API calls
   - Handles communication with the `generate-image-from-text` edge function
   - Error handling and response validation

2. **`src/components/aiChat/Components/ImageGenerator.tsx`**
   - Modal component for image generation interface
   - Manages image generation state
   - Handles download, copy, and send-to-chat actions
   - Auto-generation support for detected commands

3. **`src/hooks/useImageGenerationDetector.ts`**
   - Custom hook for detecting image generation requests
   - Pattern matching for commands and natural language
   - Prompt extraction from user messages

#### Modified Files:
1. **`src/components/aiChat/AiChat.tsx`**
   - Added ImageGenerator modal integration
   - Implemented image generation detection
   - Added menu item for image generation
   - Added handler for attaching generated images to messages

### Architecture

```
User Input → Detection Hook → Modal Opens
                ↓
           Edge Function (generate-image-from-text)
                ↓
         Google Gemini API (Imagen)
                ↓
         Supabase Storage Upload
                ↓
        Public URL Returned
                ↓
        Image Displayed in Modal
                ↓
    Optionally Attached to Chat Message
```

### API Integration

The feature uses the existing `generate-image-from-text` Supabase Edge Function:
- **Endpoint**: `/functions/v1/generate-image-from-text`
- **Method**: POST
- **Parameters**:
  - `description`: Text description of the image
  - `userId`: Current user's ID
- **Response**:
  - `imageUrl`: Public URL of the generated image
  - `error`: Error message if generation failed

### Storage

Generated images are stored in the Supabase Storage bucket:
- **Bucket**: `generatedimages`
- **Path**: `{userId}/generated_image_{timestamp}.png`
- **Format**: PNG (1024x1024 pixels)
- **Access**: Public URLs

## Usage Examples

### Example 1: Quick Command
```
User types: /image a beautiful sunset over ocean waves
→ Modal opens automatically with prompt pre-filled
→ Image generates automatically
→ User can download or send to chat
```

### Example 2: Menu Access
```
User clicks menu → "Generate AI Image"
→ Modal opens
→ User enters: "A futuristic cyberpunk city at night"
→ Clicks "Generate Image"
→ Image appears in modal
→ User clicks "Send to Chat"
→ Image attached to next message
```

### Example 3: Natural Language
```
User types: "Can you generate an image of a dragon flying over a castle?"
→ System detects image generation request
→ Modal opens with prompt: "a dragon flying over a castle"
→ Auto-generates the image
→ User can send to chat
```

## Error Handling

The integration includes comprehensive error handling:
- Empty prompt validation
- API error messages
- Network error detection
- Rate limiting notifications
- User-friendly error toasts

## Subscription Integration

The image generation feature respects the existing subscription system:
- Uses SubscriptionGuard for AI features
- Counts towards AI message limits if applicable
- Can be configured per subscription tier

## Future Enhancements

Potential improvements for future versions:
1. **Image Editing**: Allow users to edit/refine generated images
2. **Batch Generation**: Generate multiple variations at once
3. **Style Presets**: Quick style selection (realistic, artistic, cartoon, etc.)
4. **Image-to-Image**: Use existing images as reference
5. **History**: Keep track of previously generated images
6. **Size Options**: Allow different output dimensions
7. **Advanced Parameters**: Expose more Imagen parameters (guidance scale, etc.)

## Testing Checklist

- [x] Menu button opens image generator
- [x] Text commands trigger image generation
- [x] Natural language detection works
- [x] Image generation API call succeeds
- [x] Generated images display correctly
- [x] Download functionality works
- [x] Copy URL to clipboard works
- [x] Send to chat attaches image properly
- [x] Error messages display appropriately
- [x] Loading states appear correctly
- [x] Mobile responsive design
- [x] Dark mode styling
- [x] Keyboard shortcuts functional

## Known Limitations

1. Image generation requires an active internet connection
2. Generation time depends on API response (usually 5-15 seconds)
3. Images are limited to 1024x1024 pixels
4. One image per generation (no batch support yet)
5. No image editing/refinement after generation

## Support

For issues or questions about image generation:
1. Check Supabase Edge Function logs
2. Verify GCP service account credentials
3. Ensure `generatedimages` storage bucket exists
4. Check user subscription tier and limits
