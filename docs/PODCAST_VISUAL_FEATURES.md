# Podcast Visual Features

## Overview
Enhanced podcast generation system with support for multiple media types:
- **Audio Only**: Traditional audio podcast
- **Image + Audio**: Audio with AI-generated visual illustrations
- **Video Podcast**: Full video with animated visuals and slides
- **Live AI Stream**: Real-time AI-powered video stream

## Features Added

### 1. Podcast Type Selection (UI)
- Location: `src/components/aiChat/PodcastGenerator.tsx`
- Four podcast types with visual icons and descriptions
- Premium badge for live streaming
- Integrated into existing podcast generation flow

### 2. Image Generation (Backend)
- Location: `supabase/functions/generate-podcast/index.ts`
- Uses Gemini AI to extract 3-5 key visual concepts
- Generates images via DALL-E 3 API
- Fallback to placeholder images if API unavailable
- Images distributed throughout podcast timeline

### 3. Visual Assets Storage
- Database Migration: `supabase/migrations/20250125180000_add_podcast_visual_features.sql`
- Added columns:
  - `podcast_type`: Type of podcast (audio/image-audio/video/live-stream)
  - `visual_assets`: JSONB array of visual content with metadata

### 4. Enhanced Player (Frontend)
- Location: `src/components/aiChat/Components/PodcastPanel.tsx`
- Displays current visual based on playback time
- Visual timeline with thumbnails
- Click thumbnails to jump to specific moments
- Automatic switching between visuals during playback

## Usage

### Generating a Visual Podcast

1. Open Podcast Generator from AI Chat or Dashboard
2. Select notes/documents for content
3. Choose **Podcast Type**:
   - Select "Image + Audio" for visual podcast
   - Select "Video Podcast" for full video
   - Select "Live AI Stream" for real-time streaming
4. Configure style and duration
5. Click "Generate Podcast"

### Viewing Visual Content

When playing a podcast with visuals:
- Large visual display appears above player controls
- Shows current image based on playback timestamp
- Thumbnail timeline allows quick navigation
- Captions show concept and description

## Technical Implementation

### Image Generation Flow

1. **Content Analysis**
   - Gemini extracts 3-5 key concepts from script
   - Each concept includes title and visual description

2. **Image Creation**
   - **Gemini Imagen 3** generates 1792x1024 images (16:9 ratio)
   - Professional, educational style
   - High quality, suitable for thumbnails
   - Returns base64-encoded PNG images

3. **Video Creation** (for Video Podcast type)
   - **Gemini Veo** generates 5-7 second video clips
   - 16:9 aspect ratio, 24fps, standard quality
   - Creates 3 videos distributed across podcast
   - Base64-encoded MP4 videos

4. **Timeline Distribution**
   - Images/videos evenly distributed across podcast duration
   - Timestamp stored for automatic switching

### Data Structure

```typescript
interface VisualAsset {
  type: 'image' | 'video';
  concept: string;          // Title of the concept
  description: string;      // Detailed visual description
  url: string;             // Image URL (DALL-E or placeholder)
  timestamp: number;       // When to show (in seconds)
}
```

### Database Schema

```sql
ALTER TABLE ai_podcasts 
ADD COLUMN podcast_type TEXT DEFAULT 'audio',
ADD COLUMN visual_assets JSONB;
```

## Environment Variables Required

Already configured in your environment:

```bash
# For image and video generation
GEMINI_API_KEY=...your-gemini-key

# No additional keys needed - uses existing Gemini API
```

All visual generation uses Google's Gemini models:
- **Imagen 3**: Image generation
- **Veo**: Video generation

## Future Enhancements

### Planned Features
1. **Video Generation**
   - Integrate with Runway or Pika Labs API
   - Create video from images + audio
   - Add transitions and effects

2. **Live Streaming**
   - Real-time AI avatar generation
   - Interactive visual responses
   - WebRTC integration

3. **Custom Visuals**
   - User upload custom images
   - Select from image library
   - AI style transfer options

4. **Advanced Video Features**
   - Animated text overlays
   - Charts and diagrams
   - Screen recordings integration

## API Integration

### Gemini Imagen 3 Image Generation

```typescript
const imagenResponse = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${geminiApiKey}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{
        prompt: imagePrompt
      }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "16:9",
        negativePrompt: "blurry, low quality, distorted, ugly",
        safetyFilterLevel: "block_some",
        personGeneration: "allow_adult"
      }
    })
  }
);
```

### Gemini Veo Video Generation

```typescript
const veoResponse = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/veo-001:predict?key=${geminiApiKey}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{
        prompt: videoPrompt
      }],
      parameters: {
        duration: "5s",
        aspectRatio: "16:9",
        quality: "standard",
        frameRate: 24
      }
    })
  }
);
```

## Performance Considerations

1. **Image Generation Time**: 5-10 seconds per image
2. **Total Generation Time**: +30-60 seconds for visual podcast
3. **Storage**: ~500KB per image (5 images = 2.5MB)
4. **Bandwidth**: Images lazy-loaded in player

## Troubleshooting

### Images Not Generating
- Verify GEMINI_API_KEY is set correctly
- Check API quota and billing in Google Cloud Console
- Fallback to placeholders automatically if API fails

### Video Generation Issues
- Video generation takes longer (10-15 seconds per video)
- Limited to 3 videos per podcast for performance
- Falls back to images only if Veo API unavailable

### Visual Assets Not Displaying
- Check `visual_assets` column in database
- Verify podcast_type is set correctly
- For base64 images/videos, ensure data is valid

### Performance Issues
- Images: ~5-10 seconds per image
- Videos: ~10-15 seconds per video
- Consider audio-only for faster generation
- Reduce number of concepts (default: 3-5)

## Files Modified

1. **Frontend**:
   - `src/components/aiChat/PodcastGenerator.tsx` - Type selection UI
   - `src/components/aiChat/Components/PodcastPanel.tsx` - Visual display

2. **Backend**:
   - `supabase/functions/generate-podcast/index.ts` - Image generation logic

3. **Database**:
   - `supabase/migrations/20250125180000_add_podcast_visual_features.sql` - Schema changes

4. **Documentation**:
   - `docs/PODCAST_VISUAL_FEATURES.md` - This file

## Dependencies

- **Gemini API** for all AI features:
  - Gemini 1.5 Flash: Concept extraction
  - Imagen 3: Image generation
  - Veo: Video generation
- Existing podcast generation system (Gemini + Google TTS)
- Database support for JSONB

## Testing

1. Generate audio-only podcast (baseline)
2. Generate image-audio podcast with OpenAI key
3. Generate image-audio podcast without key (placeholders)
4. Play podcast and verify visual switching
5. Click timeline thumbnails for navigation
6. Test on mobile and desktop

## Support

For issues or questions:
- Check console logs for generation errors
- Verify API keys are configured
- Review database schema changes
- Test with audio-only first, then add visuals
