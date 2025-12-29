# Quick Start - Testing the Streaming System

## Prerequisites

1. **Environment Setup:**
   - Supabase project configured
   - Edge functions deployed
   - Gemini API key set in environment variables
   - Database migrations run (including `thinking_steps` column)

2. **Required Tools:**
   - Modern browser (Chrome, Firefox, Safari, Edge)
   - Browser DevTools open (F12)
   - Supabase CLI (optional, for local testing)

## Step-by-Step Testing

### 1. Start the Application

```bash
# Development mode
npm run dev

# or
bun run dev
```

Navigate to `http://localhost:5173` (or your dev server port)

### 2. Enable Streaming Mode

1. Go to the Chat tab
2. Look for the toggle button at the bottom of the input area
3. Click to enable **🧠 Thinking Mode**
4. Verify localStorage:
   ```javascript
   // In browser console:
   localStorage.getItem('ai-streaming-mode')
   // Should return: "true"
   ```

### 3. Send a Test Message

**Good test messages:**
- "Explain how neural networks work"
- "What's the difference between supervised and unsupervised learning?"
- "Help me understand transformers in AI"

**Why these work well:**
- Require understanding of intent
- Need context retrieval from knowledge base
- Involve reasoning and explanation
- Generate detailed responses

### 4. Watch the Thinking Steps

You should see 6 phases appear sequentially:

#### Phase 1: Understanding (Blue, ~1s)
```
🧠 Understanding your question
Status: In Progress → Completed
Details:
  - Intent: question
  - Entities: [neural networks, machine learning]
  - Confidence: 0.95
```

#### Phase 2: Retrieval (Green, ~2s)
```
📚 Gathering relevant information
Status: In Progress → Completed
Details:
  - Notes found: 3
  - Documents found: 2
  - Context items: 47
```

#### Phase 3: Reasoning (Purple, ~1s)
```
🤔 Building reasoning chain
Status: In Progress → Completed
Details:
  - Hypotheses formed: 2
  - Logical steps: 5
  - Confidence: 0.92
```

#### Phase 4: Memory (Orange, ~1s)
```
🧠 Accessing memory
Status: In Progress → Completed
Details:
  - Working memory: 3 items
  - Long-term memory: 5 items
  - Episodic memory: 2 conversations
```

#### Phase 5: Verification (Red, ~1s)
```
✓ Verifying response
Status: In Progress → Completed
Details:
  - Confidence: 0.93
  - Contradictions: 0
  - Reliability: High
```

#### Phase 6: Action (Teal, ~1s)
```
⚡ Generating response
Status: In Progress → Completed
Details:
  - Tools selected: [text_generation]
  - Response length: ~500 words
  - Quality score: 0.94
```

#### Phase 7: Content Streaming
- Words appear one-by-one
- Typing animation active
- Smooth scrolling to bottom

### 5. Verify in Browser DevTools

**Network Tab:**
1. Open DevTools (F12) → Network tab
2. Send a message
3. Look for `gemini-chat` request
4. **Request:**
   - Method: POST
   - Content-Type: application/json
   - Body should include: `"enableStreaming": true`
5. **Response:**
   - Content-Type: text/event-stream
   - Status: 200 OK
   - Response stream shows SSE events:
     ```
     event: thinking_step
     data: {"type":"understanding",...}

     event: thinking_step
     data: {"type":"retrieval",...}

     event: content
     data: {"chunk":"Neural "}

     event: done
     data: {"aiMessageId":"..."}
     ```

**Console Tab:**
1. Check for any errors
2. Should see successful SSE parsing
3. No errors about missing thinking_steps

**Application Tab:**
1. Go to Local Storage
2. Find `ai-streaming-mode`
3. Value should be `"true"`

### 6. Verify Database Storage

**Using Supabase Dashboard:**
1. Go to Table Editor
2. Open `chat_messages` table
3. Find your test message (role = 'assistant')
4. Check `thinking_steps` column
5. Should see JSONB array with 6 objects:
   ```json
   [
     {
       "type": "understanding",
       "phase": "Understanding your question",
       "status": "completed",
       "timestamp": "2024-01-15T10:30:00Z",
       "details": {...}
     },
     ...5 more steps...
   ]
   ```

**Using SQL:**
```sql
SELECT 
  id,
  content,
  thinking_steps,
  created_at
FROM chat_messages
WHERE role = 'assistant'
ORDER BY created_at DESC
LIMIT 1;
```

### 7. Test Fast Mode (Non-Streaming)

1. Click toggle to switch to **💬 Fast Mode**
2. Verify localStorage: `localStorage.getItem('ai-streaming-mode')` → `"false"`
3. Send same test message
4. Should see:
   - No thinking steps
   - Loading indicator
   - Immediate complete response
   - Faster overall (~3-5s vs ~6-9s)

### 8. Test Error Handling

**Force an error:**
1. Disconnect internet briefly
2. Send a message
3. Should see:
   - Optimistic message removed
   - Toast error: "Streaming error: Network error"
   - No crash

**Retry:**
1. Reconnect internet
2. Click "Retry" button
3. Should work normally

### 9. Test Mobile Responsiveness

**On mobile device or DevTools device mode:**
1. Enable streaming mode
2. Send message
3. Verify:
   - Toggle button shows emoji only (no text)
   - Thinking steps display in single column
   - Cards are readable on small screen
   - Animations don't lag

### 10. Test Dark Mode

1. Toggle dark mode in app settings
2. Send message with streaming
3. Verify:
   - Thinking steps have correct dark colors
   - Text is readable
   - Icons are visible
   - No contrast issues

## Expected Results Summary

| Test | Expected Result | Status |
|------|-----------------|--------|
| Enable streaming | Toggle shows 🧠 Thinking Mode | ⬜ |
| Send message | 6 thinking phases appear | ⬜ |
| Content streams | Words appear progressively | ⬜ |
| Database saves | thinking_steps column populated | ⬜ |
| Fast mode | No thinking steps, faster response | ⬜ |
| Error handling | Graceful fallback, no crash | ⬜ |
| Mobile | Responsive layout, readable | ⬜ |
| Dark mode | Correct colors, readable | ⬜ |
| Performance | <10s total response time | ⬜ |
| Persistence | Preference saved in localStorage | ⬜ |

## Common Issues & Solutions

### Issue: No thinking steps appearing

**Symptoms:**
- Toggle is on but no steps show
- Only final response appears

**Debug steps:**
1. Check browser console for errors
2. Verify edge function deployed:
   ```bash
   supabase functions list
   ```
3. Check edge function logs:
   ```bash
   supabase functions logs gemini-chat
   ```
4. Verify `handleStreamingResponse` function exists in index.ts
5. Test edge function directly:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/gemini-chat \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"enableStreaming":true,"message":"test"}'
   ```

### Issue: Stream hangs/freezes

**Symptoms:**
- Some thinking steps appear
- Stream stops mid-way
- No final response

**Debug steps:**
1. Check edge function timeout (default 55s):
   ```toml
   # supabase/functions/gemini-chat/deno.json
   {
     "timeout": 60
   }
   ```
2. Check Gemini API rate limits
3. Verify database connection not timing out
4. Check browser DevTools Network tab for connection closed

### Issue: Content appears all at once

**Symptoms:**
- Thinking steps work
- But content doesn't stream word-by-word

**Debug steps:**
1. Verify backend sends content chunks:
   ```typescript
   for (const word of responseWords) {
     await streamHandler.sendContentChunk(word + ' ')
   }
   ```
2. Check frontend `onContentChunk` callback:
   ```typescript
   onContentChunk: (chunk) => {
     setChatMessages(prev => 
       prev.map(msg => 
         msg.id === optimisticAiMessageId 
           ? { ...msg, content: msg.content + chunk }
           : msg
       )
     )
   }
   ```

### Issue: Toggle button not showing

**Symptoms:**
- Input area looks normal
- No 🧠/💬 button visible

**Debug steps:**
1. Check if `enableStreamingMode` state exists in AiChat.tsx
2. Verify button rendering code present
3. Check CSS classes not hiding button
4. Test in different browser

## Performance Benchmarks

Run these benchmarks to verify performance:

```javascript
// In browser console
const startTime = performance.now()

// Send message, wait for complete response

const endTime = performance.now()
console.log(`Total time: ${endTime - startTime}ms`)

// Expected:
// Streaming: 6000-9000ms
// Fast mode: 3000-5000ms
```

## Automated Testing Script

```javascript
// Copy-paste into browser console
async function testStreaming() {
  console.log('🧪 Starting streaming test...')
  
  // 1. Check localStorage
  const isEnabled = localStorage.getItem('ai-streaming-mode') === 'true'
  console.log(`✓ Streaming enabled: ${isEnabled}`)
  
  // 2. Wait for message to complete
  const startTime = Date.now()
  
  // Assuming you've sent a message, wait for it to complete
  await new Promise(resolve => setTimeout(resolve, 10000))
  
  const endTime = Date.now()
  console.log(`✓ Response time: ${endTime - startTime}ms`)
  
  // 3. Check database (requires API call)
  // ... add your database check logic
  
  console.log('✅ Streaming test complete!')
}

testStreaming()
```

## Next Steps After Testing

Once all tests pass:

1. **Deploy to staging:**
   ```bash
   supabase functions deploy gemini-chat --no-verify-jwt
   ```

2. **Run database migration:**
   ```sql
   ALTER TABLE chat_messages 
   ADD COLUMN IF NOT EXISTS thinking_steps JSONB DEFAULT '[]';
   ```

3. **Enable for production:**
   - Monitor error rates
   - Track streaming vs fast mode adoption
   - Collect user feedback

4. **Set up monitoring:**
   - Add Sentry for error tracking
   - Add analytics for streaming usage
   - Monitor edge function performance

## Getting Help

If you encounter issues:

1. **Check documentation:**
   - [STREAMING_SYSTEM_GUIDE.md](./STREAMING_SYSTEM_GUIDE.md)
   - [AGENTIC_SYSTEM_README.md](../supabase/functions/gemini-chat/AGENTIC_SYSTEM_README.md)

2. **Review logs:**
   - Browser DevTools Console
   - Supabase Edge Function logs
   - Network tab for SSE events

3. **Test in isolation:**
   - Test edge function directly with curl
   - Test frontend with mock data
   - Test streaming hook in isolation

4. **Create issue:**
   - Provide error logs
   - Include browser/OS info
   - Share reproducible steps

---

**Happy Testing! 🧪**
