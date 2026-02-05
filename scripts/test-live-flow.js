
// Scripts/test-live-flow.js
// Run with: node scripts/test-live-flow.js
// Ensure you have SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables set, 
// or edit the constants below (DO NOT COMMIT SECRETS).

import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';
const TEST_PODCAST_ID = process.env.TEST_PODCAST_ID; // Optional: specific podcast to attach to
// ---------------------

async function runTest() {
  console.log('🚀 Starting Backend Live Recording Flow Test...');

  if (SUPABASE_URL.includes('YOUR_')) {
    console.error('❌ Error: Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 1. Get a target Podcast
    let podcastId = TEST_PODCAST_ID;
    if (!podcastId) {
      console.log('🔍 Finding a podcast to test with...');
      const { data: podcasts, error } = await supabase.from('ai_podcasts').select('id, title').limit(1);
      if (error) throw error;
      if (!podcasts || podcasts.length === 0) throw new Error('No podcasts found in DB to test with.');
      podcastId = podcasts[0].id;
      console.log(`✅ Using Podcast: ${podcasts[0].title} (${podcastId})`);
    }

    // 2. Start Recording Session (New Function)
    console.log('🎬 2. Testing start-recording-session...');
    const sessionId = `test-session-${Date.now()}`;
    // Using invoke with service role (automatically handled by client based on key?) 
    // No, client uses the key provided. Service Role key bypasses RLS.
    // However, invoke calls the function via HTTP. Functions verify auth header.
    // If we use supabase-js with service key, it sends Authorization: Bearer <service_key>.
    
    // We can simulate the client call pattern or just call the function directly.
    // The previous issue was RLS on the client. `start-recording-session` bypasses it.
    
    // Note: Edge Functions often need "Authorization" header.
    const { data: startData, error: startError } = await supabase.functions.invoke('start-recording-session', {
      body: { podcast_id: podcastId, session_id: sessionId }
    });

    if (startError) throw new Error(`Start failed: ${startError.message}`);
    if (startData.error) throw new Error(`Start returned error: ${startData.error}`);
    console.log('✅ Session Created:', startData);

    // 3. Upload a Fake Chunk
    console.log('📤 3. Testing upload-podcast-chunk...');
    const chunkContent = new TextEncoder().encode('This is a test audio chunk content for validation.');
    const blob = new Blob([chunkContent], { type: 'text/plain' }); // Using text/plain for test, function handles mime
    const chunkIndex = 0;
    const filename = `backend-test/${sessionId}/chunk_${chunkIndex}.txt`;

    // Direct storage upload mimicking client
    const { error: storageError } = await supabase.storage.from('podcasts').upload(filename, blob, { contentType: 'text/plain' });
    if (storageError) throw storageError;
    console.log('   - Storage upload success');

    // Edge function registration
    const { data: chunkData, error: chunkError } = await supabase.functions.invoke('upload-podcast-chunk', {
      body: {
        podcast_id: podcastId,
        upload_session_id: sessionId,
        chunk_index: chunkIndex,
        storage_path: filename,
        file_size: chunkContent.length,
        mime_type: 'text/plain'
      }
    });

    if (chunkError) throw new Error(`Chunk upload failed: ${chunkError.message}`);
    if (!chunkData.success) throw new Error(`Chunk upload error: ${chunkData.error}`);
    console.log('✅ Chunk Registered:', chunkData);

    // 4. Finalize Recording
    console.log('🏁 4. Testing complete-podcast-chunks...');
    const { data: finalData, error: finalError } = await supabase.functions.invoke('complete-podcast-chunks', {
      body: {
        podcast_id: podcastId,
        upload_session_id: sessionId,
        trigger_transcription: false // Skip expensive/slow AI for this quick test
      }
    });

    if (finalError) throw new Error(`Finalize failed: ${finalError.message}`);
    if (finalData.error) throw new Error(`Finalize returned error: ${finalData.error}`);
    
    console.log('✅ Recording Finalized!');
    console.log('   - Assembled URL:', finalData.assembled_file_url);
    if (!finalData.segment) {
       console.warn('⚠️  Warning: Segment data missing in response (Linkage might have failed if format was invalid)');
    } else {
       console.log('   - Linked Audio Segment:', finalData.segment.id);
    }

    // 5. Verify Database State
    console.log('🔎 5. Verifying DB state...');
    const { data: recData } = await supabase.from('podcast_recordings').select('*').eq('session_id', sessionId).single();
    if (!recData) throw new Error('Recording row not found in DB!');
    if (recData.status !== 'finalized') throw new Error(`Recording status is ${recData.status}, expected finalized`);
    console.log('✅ DB Verification Passed: Recording is finalized.');

    console.log('\n🎉 SUCCESS: The backend recording flow is fully functional.');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    if (err.cause) console.error('Cause:', err.cause);
  }
}

runTest();
