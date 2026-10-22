export const EXTRACTION_PROMPTS: Record<string, string> = {
  text: `Extract and preserve ALL text content from this document with complete fidelity:

REQUIREMENTS:
1. Extract every single character, word, and line
2. Preserve all formatting indicators (spacing, line breaks, special characters)
3. Maintain document structure and hierarchy
4. Include all metadata, headers, footers, and annotations
5. Preserve table structures and list formatting
6. Extract text from any embedded elements

QUALITY STANDARDS:
- Zero truncation - extract complete content
- Maintain readability and logical flow
- Preserve technical terms and specialized vocabulary
- Include all numbers, dates, and statistical data
- Capture all references, citations, and footnotes

OUTPUT FORMAT:
Provide the complete extracted text in a clean, structured format that preserves the original document's organization and meaning.`,

  pdf: `Perform comprehensive PDF content extraction with maximum fidelity:

EXTRACTION SCOPE:
1. ALL textual content from every page
2. Complete table data with proper structure
3. All headings, subheadings, and body text
4. Footnotes, references, and citations
5. Figure captions and annotations
6. Header and footer information
7. Text within images or charts (OCR)
8. Mathematical formulas and equations
9. Bullet points, numbered lists, and indentation
10. Special characters and symbols

STRUCTURAL PRESERVATION:
- Maintain page organization and flow
- Preserve hierarchical document structure
- Keep table formatting and data relationships
- Retain list structures and numbering
- Preserve paragraph breaks and sections

QUALITY ASSURANCE:
- Extract 100% of readable content
- Maintain technical accuracy
- Preserve document context and meaning
- Include all data points and statistics`,

  document: `Execute complete document content extraction:

COMPREHENSIVE EXTRACTION:
1. Every paragraph, sentence, and word
2. All formatting that affects meaning
3. Complete table contents and structures
4. All lists, bullets, and numbering
5. Headers, footers, and page elements
6. Comments, tracked changes, and annotations
7. Embedded objects and their text content
8. All metadata and document properties

CONTENT FIDELITY:
- Zero content loss or truncation
- Preserve technical terminology
- Maintain data accuracy and relationships
- Include all numerical data and statistics
- Preserve legal or formal language precision`,

  spreadsheet: `Extract complete spreadsheet data with full fidelity:

DATA EXTRACTION:
1. All cell contents across all sheets
2. Complete formulas and calculated values
3. All headers and column/row labels
4. Data validation rules and formats
5. Comments and cell annotations
6. Charts and graph data
7. Pivot table information
8. All worksheets and their relationships

STRUCTURE PRESERVATION:
- Maintain data relationships and dependencies
- Preserve calculation logic and formulas
- Keep data types and formatting context
- Maintain sheet organization and naming
- Preserve data validation and constraints`,

  presentation: `Extract comprehensive content from this presentation:

SLIDE CONTENT:
1. All slide titles and text content
2. Bullet points and lists
3. Speaker notes if accessible
4. Slide sequence and organization

VISUAL ELEMENTS:
- Charts, graphs, and their data
- Images and diagrams with descriptions
- Layout and design context

STRUCTURE:
- Presentation flow and logic
- Key themes and messages
- Conclusion and takeaways

Maintain the narrative flow of the presentation.`,

  image: `Analyze this image with comprehensive detail extraction:

VISUAL ANALYSIS:
1. Extract ALL visible text (printed, handwritten, signage)
2. Identify and describe all objects, people, and scenes
3. Analyze charts, graphs, and their complete data
4. Describe document layouts and structures
5. Extract mathematical equations and formulas
6. Identify all colors, styles, and formatting
7. Analyze spatial relationships and layouts
8. Describe technical diagrams and schematics

TEXT EXTRACTION:
- OCR all readable text with high accuracy
- Preserve text positioning and formatting
- Extract text in multiple languages
- Include partial or degraded text with notes
- Maintain text hierarchy and organization

CONTEXTUAL UNDERSTANDING:
- Interpret document purpose and type
- Analyze data patterns and trends
- Provide meaningful insights and relationships
- Explain technical content and diagrams`,

    audio: `Produce a complete VERBATIM transcript of this audio. This is a transcription task, NOT a summary or analysis.

RULES:
1. Transcribe every utterance, in order, from the first second to the last. Never skip, merge, shorten, paraphrase or summarise any turn, including short ones such as "mm", "okay", laughter.
2. First identify the language of every turn, then transcribe each language as spoken. Do not translate or replace non-English speech with labels such as "<foreign spoken>", "[Foreign speech]", "[foreign language]", "[non-English]", or "[unintelligible]" merely because the language is unfamiliar. For Akan (Twi) and other Ghanaian languages, use standard spelling with special letters (ɛ, ɔ) when possible. If you are unsure of a word, provide your best phonetic spelling followed by [unclear]. Use [unintelligible, about N seconds] only when the audio itself cannot be understood, not when the language is non-English.
3. Under every turn that is not in English, add a line "Translation:" with the English meaning. Do not add translation lines for English turns.
4. Start every turn on a new line with a [mm:ss] timestamp and the speaker label. Use role labels if clear from context (Researcher, Interpreter, Informant); otherwise Speaker 1, Speaker 2, and keep each label consistent for the same person.
5. Keep false starts, repetitions, fillers and overlapping speech exactly as spoken. Do not correct grammar.
6. Mark non-speech sounds in square brackets, for example [laughter], [baby crying].
7. Output ONLY the transcript. Do NOT include a summary, key themes, metadata, audio-quality notes or analysis.
8. If you cannot finish within your output limit, stop at the end of a complete turn and write "LAST TIMESTAMP REACHED: mm:ss". Never compress or summarise to make it fit.`,

  code: `Analyze this code file with complete preservation:

CODE ANALYSIS:
1. Extract all source code with exact formatting
2. Preserve indentation and code structure
3. Include all comments and documentation
4. Maintain syntax highlighting context
5. Extract embedded documentation
6. Preserve import/export statements
7. Include all variable and function definitions

STRUCTURAL PRESERVATION:
- Maintain file organization and hierarchy
- Preserve code blocks and functions
- Keep syntax and formatting intact
- Include all metadata and headers`,

  archive: `Analyze this archive file and extract available metadata:

METADATA EXTRACTION:
1. Archive type and compression method
2. File structure and directory listings
3. Individual file information if accessible
4. Compression ratios and technical details
5. Creation dates and modification times

Note: This is an archive file. Extract any readable metadata, file structure information, or accessible text content. Describe what type of archive this is and what it might contain.`,

  video: `Analyze this video file for available content:

VIDEO ANALYSIS:
1. Extract any available metadata
2. Analyze accessible frames or thumbnails
3. Describe video format and technical specifications
4. Extract any embedded text or captions
5. Identify visual content if frames are available

Note: This is a video file. Analyze any extractable frames or metadata. Describe the video format and any available information. Note: Full video analysis would require specialized video processing.`,
};