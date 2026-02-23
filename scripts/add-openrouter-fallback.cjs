const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'supabase', 'functions');

const OR_IMPORT = "import { callOpenRouterFallback } from '../_shared/openRouterFallback.ts';";

function addImport(content, anchorImport) {
  if (content.includes('openRouterFallback')) return content;
  return content.replace(anchorImport, anchorImport + '\n' + OR_IMPORT);
}

let updated = 0;

// ═══════════════════════════════════════════════════════════════════════════
// 1. generate-dashboard-insights  (helper throws, returns {text, model})
// ═══════════════════════════════════════════════════════════════════════════
{
  const fp = path.join(BASE, 'generate-dashboard-insights', 'index.ts');
  let c = fs.readFileSync(fp, 'utf8');
  c = addImport(c, "import { logSystemError } from '../_shared/errorLogger.ts';");
  c = c.replace(
    "  throw new Error('All Gemini models failed — quota or service issue');\n}",
    `  // OpenRouter fallback
  const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'dashboard-insights' });
  if (orResult.success && orResult.content) {
    return { text: orResult.content, model: 'openrouter/free' };
  }
  throw new Error('All AI models failed (Gemini + OpenRouter)');
}`
  );
  fs.writeFileSync(fp, c);
  console.log('Updated: generate-dashboard-insights');
  updated++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. generate-note-from-document  (helper throws, returns string)
// ═══════════════════════════════════════════════════════════════════════════
{
  const fp = path.join(BASE, 'generate-note-from-document', 'index.ts');
  let c = fs.readFileSync(fp, 'utf8');
  c = addImport(c, "import { logSystemError } from '../_shared/errorLogger.ts';");
  c = c.replace(
    "  throw new Error('All Gemini models failed — quota or service issue');\n}",
    `  // OpenRouter fallback
  const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'generate-note-from-document' });
  if (orResult.success && orResult.content) {
    return orResult.content;
  }
  throw new Error('All AI models failed (Gemini + OpenRouter)');
}`
  );
  fs.writeFileSync(fp, c);
  console.log('Updated: generate-note-from-document');
  updated++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. generate-flashcards  (helper throws, returns {text, model})
// ═══════════════════════════════════════════════════════════════════════════
{
  const fp = path.join(BASE, 'generate-flashcards', 'index.ts');
  let c = fs.readFileSync(fp, 'utf8');
  c = addImport(c, "import { logSystemError } from '../_shared/errorLogger.ts';");
  c = c.replace(
    "  throw new Error('All Gemini models failed — quota or service issue');\n}",
    `  // OpenRouter fallback
  const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'generate-flashcards' });
  if (orResult.success && orResult.content) {
    return { text: orResult.content, model: 'openrouter/free' };
  }
  throw new Error('All AI models failed (Gemini + OpenRouter)');
}`
  );
  fs.writeFileSync(fp, c);
  console.log('Updated: generate-flashcards');
  updated++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. generate-inline-content  (inline loop, checks if (!aiContent))
// ═══════════════════════════════════════════════════════════════════════════
{
  const fp = path.join(BASE, 'generate-inline-content', 'index.ts');
  let c = fs.readFileSync(fp, 'utf8');
  c = addImport(c, "import { logSystemError } from '../_shared/errorLogger.ts';");
  c = c.replace(
    "\tif (!aiContent) {\n\t\tthrow new Error('All Gemini models failed — quota or service issue');\n\t}",
    `\tif (!aiContent) {
\t\t// OpenRouter fallback
\t\tconst orResult = await callOpenRouterFallback(requestBody.contents, { source: 'generate-inline-content' });
\t\tif (orResult.success && orResult.content) {
\t\t\taiContent = orResult.content;
\t\t} else {
\t\t\tthrow new Error('All AI models failed (Gemini + OpenRouter)');
\t\t}
\t}`
  );
  fs.writeFileSync(fp, c);
  console.log('Updated: generate-inline-content');
  updated++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. generate-summary  (helper throws inside serve)
// ═══════════════════════════════════════════════════════════════════════════
{
  const fp = path.join(BASE, 'generate-summary', 'index.ts');
  let c = fs.readFileSync(fp, 'utf8');
  c = addImport(c, "import { logSystemError } from '../_shared/errorLogger.ts';");
  c = c.replace(
    "      throw new Error('All Gemini models failed');\n    }",
    `      // OpenRouter fallback
      const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'generate-summary' });
      if (orResult.success && orResult.content) {
        return { candidates: [{ content: { parts: [{ text: orResult.content }] } }] };
      }
      throw new Error('All AI models failed (Gemini + OpenRouter)');
    }`
  );
  fs.writeFileSync(fp, c);
  console.log('Updated: generate-summary');
  updated++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. generate-quiz  (helper throws with logSystemError before)
// ═══════════════════════════════════════════════════════════════════════════
{
  const fp = path.join(BASE, 'generate-quiz', 'index.ts');
  let c = fs.readFileSync(fp, 'utf8');
  c = addImport(c, "import { logSystemError } from '../_shared/errorLogger.ts';");
  // The pattern: logSystemError + throw
  c = c.replace(
    "      throw new Error('All Gemini models failed');\n    }",
    `      // OpenRouter fallback
      const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'generate-quiz' });
      if (orResult.success && orResult.content) {
        return { candidates: [{ content: { parts: [{ text: orResult.content }] } }] };
      }
      throw new Error('All AI models failed (Gemini + OpenRouter)');
    }`
  );
  fs.writeFileSync(fp, c);
  console.log('Updated: generate-quiz');
  updated++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. generate-podcast  (helper throws inside serve)
// ═══════════════════════════════════════════════════════════════════════════
{
  const fp = path.join(BASE, 'generate-podcast', 'index.ts');
  let c = fs.readFileSync(fp, 'utf8');
  c = addImport(c, "import { logSystemError } from '../_shared/errorLogger.ts';");
  c = c.replace(
    "      throw new Error('All Gemini models failed');\n    }",
    `      // OpenRouter fallback
      const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'generate-podcast' });
      if (orResult.success && orResult.content) {
        return { candidates: [{ content: { parts: [{ text: orResult.content }] } }] };
      }
      throw new Error('All AI models failed (Gemini + OpenRouter)');
    }`
  );
  fs.writeFileSync(fp, c);
  console.log('Updated: generate-podcast');
  updated++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. fix-diagram  (inline loop, checks if (!text))
// ═══════════════════════════════════════════════════════════════════════════
{
  const fp = path.join(BASE, 'fix-diagram', 'index.ts');
  let c = fs.readFileSync(fp, 'utf8');
  c = addImport(c, "import { logSystemError } from '../_shared/errorLogger.ts';");
  c = c.replace(
    "    if (!text) {\n      throw new Error('All Gemini models failed — quota or service issue');\n    }",
    `    if (!text) {
      // OpenRouter fallback
      const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'fix-diagram' });
      if (orResult.success && orResult.content) {
        text = orResult.content;
      } else {
        throw new Error('All AI models failed (Gemini + OpenRouter)');
      }
    }`
  );
  fs.writeFileSync(fp, c);
  console.log('Updated: fix-diagram');
  updated++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. admin-ai-insights  (returns Response(502) after loop)
// ═══════════════════════════════════════════════════════════════════════════
{
  const fp = path.join(BASE, 'admin-ai-insights', 'index.ts');
  let c = fs.readFileSync(fp, 'utf8');
  // Import anchor: we need to find the right import line. Check if it has errorLogger
  if (c.includes("import { logSystemError }")) {
    c = addImport(c, "import { logSystemError } from '../_shared/errorLogger.ts';");
  } else {
    // Add after first import
    c = c.replace(
      "import { serve }",
      OR_IMPORT + "\nimport { serve }"
    );
  }
  c = c.replace(
    `    return new Response(JSON.stringify({
      error: 'All AI models failed. Please try again.',
      details: lastError,
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });`,
    `    // OpenRouter fallback
    const orResult = await callOpenRouterFallback(contents, { source: 'admin-ai-insights', systemPrompt: systemInstruction });
    if (orResult.success && orResult.content) {
      return new Response(JSON.stringify({ response: orResult.content, model: 'openrouter/free' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({
      error: 'All AI models failed (Gemini + OpenRouter). Please try again.',
      details: lastError,
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });`
  );
  fs.writeFileSync(fp, c);
  console.log('Updated: admin-ai-insights');
  updated++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. content-moderation  (inline loop, checks if (!responseText))
// ═══════════════════════════════════════════════════════════════════════════
{
  const fp = path.join(BASE, 'content-moderation', 'index.ts');
  let c = fs.readFileSync(fp, 'utf8');
  c = addImport(c, "import { logSystemError } from '../_shared/errorLogger.ts';");
  c = c.replace(
    "    if (!responseText) {\n      throw new Error('All Gemini models failed — quota or service issue');\n    }",
    `    if (!responseText) {
      // OpenRouter fallback
      const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'content-moderation' });
      if (orResult.success && orResult.content) {
        responseText = orResult.content;
      } else {
        throw new Error('All AI models failed (Gemini + OpenRouter)');
      }
    }`
  );
  fs.writeFileSync(fp, c);
  console.log('Updated: content-moderation');
  updated++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. analyze-document-structure  (inline loop, checks if (!text))
// ═══════════════════════════════════════════════════════════════════════════
{
  const fp = path.join(BASE, 'analyze-document-structure', 'index.ts');
  let c = fs.readFileSync(fp, 'utf8');
  c = addImport(c, "import { logSystemError } from '../_shared/errorLogger.ts';");
  c = c.replace(
    "        if (!text) {\n            throw new Error('All Gemini models failed — quota or service issue');\n        }",
    `        if (!text) {
            // OpenRouter fallback
            const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'analyze-document-structure' });
            if (orResult.success && orResult.content) {
                text = orResult.content;
            } else {
                throw new Error('All AI models failed (Gemini + OpenRouter)');
            }
        }`
  );
  fs.writeFileSync(fp, c);
  console.log('Updated: analyze-document-structure');
  updated++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 12. document-processor  (returns {success:false} object)
// ═══════════════════════════════════════════════════════════════════════════
{
  const fp = path.join(BASE, 'document-processor', 'index.ts');
  let c = fs.readFileSync(fp, 'utf8');
  // No errorLogger import to anchor on — use the first import line
  if (!c.includes('openRouterFallback')) {
    c = c.replace(
      "import { serve } from \"https://deno.land/std@0.168.0/http/server.ts\";",
      "import { serve } from \"https://deno.land/std@0.168.0/http/server.ts\";\nimport { callOpenRouterFallback } from '../_shared/openRouterFallback.ts';"
    );
  }
  c = c.replace(
    "  return {\n    success: false,\n    error: 'All Gemini models failed — quota or service issue'\n  };\n}",
    `  // OpenRouter fallback
  const orResult = await callOpenRouterFallback(contents, { source: 'document-processor' });
  if (orResult.success && orResult.content) {
    return { success: true, content: orResult.content };
  }
  return {
    success: false,
    error: 'All AI models failed (Gemini + OpenRouter)'
  };
}`
  );
  fs.writeFileSync(fp, c);
  console.log('Updated: document-processor');
  updated++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 13. document-extractor  (returns {success:false} object, 'Max retries exceeded')
// ═══════════════════════════════════════════════════════════════════════════
{
  const fp = path.join(BASE, 'document-extractor', 'index.ts');
  let c = fs.readFileSync(fp, 'utf8');
  if (!c.includes('openRouterFallback')) {
    c = c.replace(
      "import { serve } from \"https://deno.land/std@0.168.0/http/server.ts\";",
      "import { serve } from \"https://deno.land/std@0.168.0/http/server.ts\";\nimport { callOpenRouterFallback } from '../_shared/openRouterFallback.ts';"
    );
  }
  c = c.replace(
    "    return {\n        success: false,\n        error: 'Max retries exceeded'\n    };\n}",
    `    // OpenRouter fallback
    const orResult = await callOpenRouterFallback(contents, { source: 'document-extractor' });
    if (orResult.success && orResult.content) {
        return { success: true, content: orResult.content };
    }
    return {
        success: false,
        error: 'All AI models failed (Gemini + OpenRouter)'
    };
}`
  );
  fs.writeFileSync(fp, c);
  console.log('Updated: document-extractor');
  updated++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 14. gemini-document-extractor  (helper throws)
// ═══════════════════════════════════════════════════════════════════════════
{
  const fp = path.join(BASE, 'gemini-document-extractor', 'index.ts');
  let c = fs.readFileSync(fp, 'utf8');
  if (!c.includes('openRouterFallback')) {
    c = c.replace(
      "import { serve } from \"https://deno.land/std@0.224.0/http/server.ts\";",
      "import { serve } from \"https://deno.land/std@0.224.0/http/server.ts\";\nimport { callOpenRouterFallback } from '../_shared/openRouterFallback.ts';"
    );
  }
  c = c.replace(
    "        throw new Error('All Gemini models failed');\n    }",
    `        // OpenRouter fallback
        const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'gemini-document-extractor' });
        if (orResult.success && orResult.content) {
            return { candidates: [{ content: { parts: [{ text: orResult.content }] } }] };
        }
        throw new Error('All AI models failed (Gemini + OpenRouter)');
    }`
  );
  fs.writeFileSync(fp, c);
  console.log('Updated: gemini-document-extractor');
  updated++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 15. create-social-post  (helper throws inside serve)
// ═══════════════════════════════════════════════════════════════════════════
{
  const fp = path.join(BASE, 'create-social-post', 'index.ts');
  let c = fs.readFileSync(fp, 'utf8');
  if (!c.includes('openRouterFallback')) {
    // anchor on existing import
    const anchor = c.includes("import { logSystemError }") 
      ? "import { logSystemError } from '../_shared/errorLogger.ts';"
      : "import { serve } from \"https://deno.land/std@0.168.0/http/server.ts\";";
    c = c.replace(anchor, anchor + '\n' + OR_IMPORT);
  }
  c = c.replace(
    "          throw new Error('All Gemini models failed');\n        }",
    `          // OpenRouter fallback
          const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'create-social-post' });
          if (orResult.success && orResult.content) {
            return { candidates: [{ content: { parts: [{ text: orResult.content }] } }] };
          }
          throw new Error('All AI models failed (Gemini + OpenRouter)');
        }`
  );
  fs.writeFileSync(fp, c);
  console.log('Updated: create-social-post');
  updated++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 16. utils/gemini.ts  (returns {success:false, error})
// ═══════════════════════════════════════════════════════════════════════════
{
  const fp = path.join(BASE, 'utils', 'gemini.ts');
  let c = fs.readFileSync(fp, 'utf8');
  if (!c.includes('openRouterFallback')) {
    c = "import { callOpenRouterFallback } from '../_shared/openRouterFallback.ts';\n" + c;
  }
  c = c.replace(
    "  return { success: false, error: 'ALL_MODELS_FAILED' };\n}",
    `  // OpenRouter fallback
  const orResult = await callOpenRouterFallback(prompt, { source: 'utils-gemini', systemPrompt: systemInstruction });
  if (orResult.success && orResult.content) {
    return { success: true, text: orResult.content, model: 'openrouter/free' };
  }
  return { success: false, error: 'ALL_MODELS_FAILED' };
}`
  );
  fs.writeFileSync(fp, c);
  console.log('Updated: utils/gemini.ts');
  updated++;
}

console.log(`\nTotal updated: ${updated} files`);
