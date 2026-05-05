const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'supabase', 'functions');

function readFile(fp) {
  return fs.readFileSync(fp, 'utf8');
}

function writeFile(fp, content) {
  fs.writeFileSync(fp, content);
}

// Normalize \r\n to \n for matching, then restore
function replaceInFile(filePath, oldStr, newStr) {
  let content = readFile(filePath);
  const hasCarriageReturn = content.includes('\r\n');
  const normalized = content.replace(/\r\n/g, '\n');
  const normalizedOld = oldStr.replace(/\r\n/g, '\n');
  
  if (!normalized.includes(normalizedOld)) {
    console.warn(`  WARNING: Pattern not found in ${path.basename(filePath)}`);
    console.warn(`  Looking for: ${normalizedOld.substring(0, 80)}...`);
    return false;
  }
  
  let result = normalized.replace(normalizedOld, newStr);
  if (hasCarriageReturn) {
    result = result.replace(/\n/g, '\r\n');
  }
  writeFile(filePath, result);
  return true;
}

let updated = 0;
let failed = 0;

const files = [
  // 1. generate-dashboard-insights
  {
    name: 'generate-dashboard-insights',
    path: 'generate-dashboard-insights/index.ts',
    old: "  throw new Error('All Gemini models failed \\u2014 quota or service issue');\n}",
    new: `  // OpenRouter fallback
  const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'dashboard-insights' });
  if (orResult.success && orResult.content) {
    return { text: orResult.content, model: 'openrouter/free' };
  }
  throw new Error('All AI models failed (Gemini + OpenRouter)');
}`,
  },
  // 2. generate-note-from-document
  {
    name: 'generate-note-from-document',
    path: 'generate-note-from-document/index.ts',
    old: "  throw new Error('All Gemini models failed \\u2014 quota or service issue');\n}",
    new: `  // OpenRouter fallback
  const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'generate-note-from-document' });
  if (orResult.success && orResult.content) {
    return orResult.content;
  }
  throw new Error('All AI models failed (Gemini + OpenRouter)');
}`,
  },
  // 3. generate-flashcards
  {
    name: 'generate-flashcards',
    path: 'generate-flashcards/index.ts',
    old: "  throw new Error('All Gemini models failed \\u2014 quota or service issue');\n}",
    new: `  // OpenRouter fallback
  const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'generate-flashcards' });
  if (orResult.success && orResult.content) {
    return { text: orResult.content, model: 'openrouter/free' };
  }
  throw new Error('All AI models failed (Gemini + OpenRouter)');
}`,
  },
  // 4. generate-inline-content
  {
    name: 'generate-inline-content',
    path: 'generate-inline-content/index.ts',
    old: "\tif (!aiContent) {\n\t\tthrow new Error('All Gemini models failed \\u2014 quota or service issue');\n\t}",
    new: `\tif (!aiContent) {
\t\t// OpenRouter fallback
\t\tconst orResult = await callOpenRouterFallback(requestBody.contents, { source: 'generate-inline-content' });
\t\tif (orResult.success && orResult.content) {
\t\t\taiContent = orResult.content;
\t\t} else {
\t\t\tthrow new Error('All AI models failed (Gemini + OpenRouter)');
\t\t}
\t}`,
  },
  // 5. generate-summary
  {
    name: 'generate-summary',
    path: 'generate-summary/index.ts',
    old: "      throw new Error('All Gemini models failed');\n    }",
    new: `      // OpenRouter fallback
      const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'generate-summary' });
      if (orResult.success && orResult.content) {
        return { candidates: [{ content: { parts: [{ text: orResult.content }] } }] };
      }
      throw new Error('All AI models failed (Gemini + OpenRouter)');
    }`,
  },
  // 6. generate-quiz
  {
    name: 'generate-quiz',
    path: 'generate-quiz/index.ts',
    old: "      throw new Error('All Gemini models failed');\n    }",
    new: `      // OpenRouter fallback
      const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'generate-quiz' });
      if (orResult.success && orResult.content) {
        return { candidates: [{ content: { parts: [{ text: orResult.content }] } }] };
      }
      throw new Error('All AI models failed (Gemini + OpenRouter)');
    }`,
  },
  // 7. generate-podcast
  {
    name: 'generate-podcast',
    path: 'generate-podcast/index.ts',
    old: "      throw new Error('All Gemini models failed');\n    }",
    new: `      // OpenRouter fallback
      const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'generate-podcast' });
      if (orResult.success && orResult.content) {
        return { candidates: [{ content: { parts: [{ text: orResult.content }] } }] };
      }
      throw new Error('All AI models failed (Gemini + OpenRouter)');
    }`,
  },
  // 8. fix-diagram
  {
    name: 'fix-diagram',
    path: 'fix-diagram/index.ts',
    old: "    if (!text) {\n      throw new Error('All Gemini models failed \\u2014 quota or service issue');\n    }",
    new: `    if (!text) {
      // OpenRouter fallback
      const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'fix-diagram' });
      if (orResult.success && orResult.content) {
        text = orResult.content;
      } else {
        throw new Error('All AI models failed (Gemini + OpenRouter)');
      }
    }`,
  },
  // 9. admin-ai-insights
  {
    name: 'admin-ai-insights',
    path: 'admin-ai-insights/index.ts',
    old: `    return new Response(JSON.stringify({
      error: 'All AI models failed. Please try again.',
      details: lastError,
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });`,
    new: `    // OpenRouter fallback
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
    });`,
  },
  // 10. content-moderation
  {
    name: 'content-moderation',
    path: 'content-moderation/index.ts',
    old: "    if (!responseText) {\n      throw new Error('All Gemini models failed \\u2014 quota or service issue');\n    }",
    new: `    if (!responseText) {
      // OpenRouter fallback
      const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'content-moderation' });
      if (orResult.success && orResult.content) {
        responseText = orResult.content;
      } else {
        throw new Error('All AI models failed (Gemini + OpenRouter)');
      }
    }`,
  },
  // 11. analyze-document-structure
  {
    name: 'analyze-document-structure',
    path: 'analyze-document-structure/index.ts',
    old: "        if (!text) {\n            throw new Error('All Gemini models failed \\u2014 quota or service issue');\n        }",
    new: `        if (!text) {
            // OpenRouter fallback
            const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'analyze-document-structure' });
            if (orResult.success && orResult.content) {
                text = orResult.content;
            } else {
                throw new Error('All AI models failed (Gemini + OpenRouter)');
            }
        }`,
  },
  // 12. document-processor
  {
    name: 'document-processor',
    path: 'document-processor/index.ts',
    old: "  return {\n    success: false,\n    error: 'All Gemini models failed \\u2014 quota or service issue'\n  };\n}",
    new: `  // OpenRouter fallback
  const orResult = await callOpenRouterFallback(contents, { source: 'document-processor' });
  if (orResult.success && orResult.content) {
    return { success: true, content: orResult.content };
  }
  return {
    success: false,
    error: 'All AI models failed (Gemini + OpenRouter)'
  };
}`,
  },
  // 13. document-extractor
  {
    name: 'document-extractor',
    path: 'document-extractor/index.ts',
    old: "    return {\n        success: false,\n        error: 'Max retries exceeded'\n    };\n}",
    new: `    // OpenRouter fallback
    const orResult = await callOpenRouterFallback(contents, { source: 'document-extractor' });
    if (orResult.success && orResult.content) {
        return { success: true, content: orResult.content };
    }
    return {
        success: false,
        error: 'All AI models failed (Gemini + OpenRouter)'
    };
}`,
  },
  // 14. gemini-document-extractor
  {
    name: 'gemini-document-extractor',
    path: 'gemini-document-extractor/index.ts',
    old: "        throw new Error('All Gemini models failed');\n    }",
    new: `        // OpenRouter fallback
        const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'gemini-document-extractor' });
        if (orResult.success && orResult.content) {
            return { candidates: [{ content: { parts: [{ text: orResult.content }] } }] };
        }
        throw new Error('All AI models failed (Gemini + OpenRouter)');
    }`,
  },
  // 15. create-social-post
  {
    name: 'create-social-post',
    path: 'create-social-post/index.ts',
    old: "          throw new Error('All Gemini models failed');\n        }",
    new: `          // OpenRouter fallback
          const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'create-social-post' });
          if (orResult.success && orResult.content) {
            return { candidates: [{ content: { parts: [{ text: orResult.content }] } }] };
          }
          throw new Error('All AI models failed (Gemini + OpenRouter)');
        }`,
  },
];

// Process each file
for (const f of files) {
  const fp = path.join(BASE, f.path);
  // The old strings use \u2014 (em dash) which gets escaped in string literals
  // We need to actually use the em dash character
  const old = f.old.replace(/\\u2014/g, '\u2014');
  const ok = replaceInFile(fp, old, f.new);
  if (ok) {
    console.log(`OK: ${f.name}`);
    updated++;
  } else {
    console.log(`FAILED: ${f.name}`);
    failed++;
  }
}

// 16. utils/gemini.ts
{
  const fp = path.join(BASE, 'utils', 'gemini.ts');
  const old = "  return { success: false, error: 'ALL_MODELS_FAILED' };\n}";
  const newStr = `  // OpenRouter fallback
  const orResult = await callOpenRouterFallback(prompt, { source: 'utils-gemini', systemPrompt: systemInstruction });
  if (orResult.success && orResult.content) {
    return { success: true, text: orResult.content, model: 'openrouter/free' };
  }
  return { success: false, error: 'ALL_MODELS_FAILED' };
}`;
  const ok = replaceInFile(fp, old, newStr);
  if (ok) {
    console.log('OK: utils/gemini.ts');
    updated++;
  } else {
    console.log('FAILED: utils/gemini.ts');
    failed++;
  }
}

console.log(`\nDone: ${updated} updated, ${failed} failed`);
