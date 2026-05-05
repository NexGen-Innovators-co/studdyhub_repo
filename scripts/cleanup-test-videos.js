/**
 * Cleanup script: Remove test video files from the generatedimages storage bucket.
 * 
 * Usage:
 *   node scripts/cleanup-test-videos.js
 * 
 * This lists all video_*.mp4 files across all user folders in the 'generatedimages'
 * bucket and deletes them. Images are preserved.
 * 
 * Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars, or they will be read
 * from .env / .env.local in the project root.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try loading env from .env.local or .env
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const line of content.split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const val = match[2].trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  console.error('Set them as environment variables or in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET = 'generatedimages';

async function main() {
  console.log(`\n🔍 Scanning bucket "${BUCKET}" for video files...\n`);

  // List all top-level folders (user IDs)
  const { data: folders, error: folderErr } = await supabase.storage
    .from(BUCKET)
    .list('', { limit: 1000 });

  if (folderErr) {
    console.error('Error listing bucket:', folderErr.message);
    process.exit(1);
  }

  const userFolders = (folders || []).filter(f => f.id === null || f.metadata === null);
  console.log(`Found ${userFolders.length} user folders.\n`);

  let totalVideoFiles = 0;
  let totalVideoSize = 0;
  const filesToDelete = [];

  for (const folder of userFolders) {
    const folderName = folder.name;
    const { data: files, error: listErr } = await supabase.storage
      .from(BUCKET)
      .list(folderName, { limit: 10000 });

    if (listErr) {
      console.warn(`  Warning: Could not list ${folderName}: ${listErr.message}`);
      continue;
    }

    const videoFiles = (files || []).filter(f => 
      f.name && (f.name.startsWith('video_') || f.name.endsWith('.mp4'))
    );

    if (videoFiles.length > 0) {
      for (const vf of videoFiles) {
        const fullPath = `${folderName}/${vf.name}`;
        const size = vf.metadata?.size || 0;
        totalVideoSize += size;
        totalVideoFiles++;
        filesToDelete.push(fullPath);
        console.log(`  📹 ${fullPath} (${(size / 1024 / 1024).toFixed(2)} MB)`);
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Video files found: ${totalVideoFiles}`);
  console.log(`   Total size: ${(totalVideoSize / 1024 / 1024).toFixed(2)} MB`);

  if (filesToDelete.length === 0) {
    console.log('\n✅ No video files to delete. Bucket is clean!');
    return;
  }

  // Confirm deletion
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  const answer = await new Promise(resolve => {
    rl.question(`\n⚠️  Delete ${filesToDelete.length} video files? (yes/no): `, resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
    console.log('Aborted.');
    return;
  }

  // Delete in batches of 100
  console.log(`\n🗑️  Deleting ${filesToDelete.length} video files...`);
  const batchSize = 100;
  let deleted = 0;
  let failed = 0;

  for (let i = 0; i < filesToDelete.length; i += batchSize) {
    const batch = filesToDelete.slice(i, i + batchSize);
    const { error: delErr } = await supabase.storage
      .from(BUCKET)
      .remove(batch);
    
    if (delErr) {
      console.error(`  Failed batch ${Math.floor(i / batchSize) + 1}: ${delErr.message}`);
      failed += batch.length;
    } else {
      deleted += batch.length;
      console.log(`  Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} files`);
    }
  }

  console.log(`\n✅ Done! Deleted: ${deleted}, Failed: ${failed}`);
  console.log(`   Freed approximately ${(totalVideoSize / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
