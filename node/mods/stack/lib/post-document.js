/**
 * Document Model for Stack Posts
 * 
 * Provides a structured document model layer between the editor UI and Markdown string.
 * The textarea still stores Markdown, but internally we work with Document structure.
 */

/**
 * Document structure
 * @typedef {Object} Document
 * @property {Block[]} blocks - Array of document blocks
 */

/**
 * Block types
 * @typedef {Object} Paragraph
 * @property {string} type - "paragraph"
 * @property {string} id - Stable unique identifier
 * @property {string} text - Plain text content
 * 
 * @typedef {Object} Heading
 * @property {string} type - "heading"
 * @property {string} id - Stable unique identifier
 * @property {number} level - Heading level (1-6)
 * @property {string} text - Heading text
 * 
 * @typedef {Object} Image
 * @property {string} type - "image"
 * @property {string} id - Stable unique identifier
 * @property {string} src - Image source URL or data URI
 * @property {string} [caption] - Optional image caption/alt text
 * 
 * @typedef {Object} RawHTML
 * @property {string} type - "rawhtml"
 * @property {string} id - Stable unique identifier
 * @property {string} html - Raw HTML content
 * 
 * @typedef {Paragraph|Heading|Image|RawHTML} Block
 */

/**
 * Generate a stable unique ID for a block
 * @param {number} index - Block index
 * @param {string} prefix - Optional prefix
 * @returns {string} Unique block ID
 */
function generateBlockId(index, prefix = 'block') {
  return `${prefix}-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse Markdown string into Document structure
 * 
 * Converts Markdown into block objects:
 * - Headings (# ## ###) → Heading blocks
 * - Images (![alt](src)) → Image blocks
 * - Raw HTML tags → RawHTML blocks
 * - Everything else → Paragraph blocks
 * 
 * @param {string} markdown - Markdown string to parse
 * @returns {Document} Document with parsed blocks
 */
function parseMarkdownToDocument(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return { blocks: [] };
  }

  const blocks = [];
  const lines = markdown.split('\n');
  let currentParagraph = [];
  let blockIndex = 0;

  // Regex patterns
  const headingRegex = /^(#{1,6})\s+(.+)$/;
  const imageRegex = /^!\[([^\]]*)\]\(([^)]+)\)(?:\s+"([^"]+)")?$/;
  const htmlTagRegex = /^<[^>]+>.*<\/[^>]+>$/;
  const htmlOpenTagRegex = /^<[^>]+>$/;
  const htmlCloseTagRegex = /^<\/[^>]+>$/;

  let inHtmlBlock = false;
  let htmlContent = [];
  let htmlTagName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip empty lines (they separate blocks)
    if (trimmedLine === '') {
      // If we have accumulated paragraph text, create a paragraph block
      if (currentParagraph.length > 0) {
        blocks.push({
          type: 'paragraph',
          id: generateBlockId(blockIndex++),
          text: currentParagraph.join('\n').trim()
        });
        currentParagraph = [];
      }
      continue;
    }

    // Check for HTML blocks
    if (htmlOpenTagRegex.test(trimmedLine)) {
      // Extract tag name
      const tagMatch = trimmedLine.match(/^<(\w+)/);
      if (tagMatch) {
        htmlTagName = tagMatch[1];
        inHtmlBlock = true;
        htmlContent = [trimmedLine];
        continue;
      }
    }

    if (inHtmlBlock) {
      htmlContent.push(trimmedLine);
      if (htmlCloseTagRegex.test(trimmedLine)) {
        // Close tag found, create RawHTML block
        blocks.push({
          type: 'rawhtml',
          id: generateBlockId(blockIndex++),
          html: htmlContent.join('\n')
        });
        inHtmlBlock = false;
        htmlContent = [];
        htmlTagName = '';
        continue;
      }
      continue;
    }

    // Check for complete HTML tags on a single line
    if (htmlTagRegex.test(trimmedLine)) {
      blocks.push({
        type: 'rawhtml',
        id: generateBlockId(blockIndex++),
        html: trimmedLine
      });
      continue;
    }

    // Check for headings
    const headingMatch = trimmedLine.match(headingRegex);
    if (headingMatch) {
      // Save any accumulated paragraph text first
      if (currentParagraph.length > 0) {
        blocks.push({
          type: 'paragraph',
          id: generateBlockId(blockIndex++),
          text: currentParagraph.join('\n').trim()
        });
        currentParagraph = [];
      }

      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      blocks.push({
        type: 'heading',
        id: generateBlockId(blockIndex++),
        level: level,
        text: text
      });
      continue;
    }

    // Check for images (including stack:image: references)
    const imageMatch = trimmedLine.match(imageRegex);
    if (imageMatch) {
      // Save any accumulated paragraph text first
      if (currentParagraph.length > 0) {
        blocks.push({
          type: 'paragraph',
          id: generateBlockId(blockIndex++),
          text: currentParagraph.join('\n').trim()
        });
        currentParagraph = [];
      }

      const alt = imageMatch[1] || '';
      let src = imageMatch[2] || '';
      const title = imageMatch[3] || '';
      
      // Preserve stack:image: references (will be resolved during rendering)
      // For drafts loaded from storage, src may already be a data URL or stack:image: reference

      blocks.push({
        type: 'image',
        id: generateBlockId(blockIndex++),
        src: src, // Can be data URL, stack:image: reference, or external URL
        caption: alt || title || undefined
      });
      continue;
    }

    // Everything else goes into paragraph
    currentParagraph.push(line);
  }

  // Don't forget the last paragraph if there is one
  if (currentParagraph.length > 0) {
    blocks.push({
      type: 'paragraph',
      id: generateBlockId(blockIndex++),
      text: currentParagraph.join('\n').trim()
    });
  }

  // If no blocks were created, create at least one empty paragraph
  if (blocks.length === 0) {
    blocks.push({
      type: 'paragraph',
      id: generateBlockId(blockIndex++),
      text: ''
    });
  }

  return { blocks: blocks };
}

/**
 * Serialize Document structure back to Markdown string
 * 
 * Converts blocks back into Markdown:
 * - Heading blocks → Markdown headings (# ## ###)
 * - Image blocks → Markdown image syntax (![alt](src))
 * - RawHTML blocks → Raw HTML (round-trips safely)
 * - Paragraph blocks → Plain text
 * 
 * @param {Document} doc - Document to serialize
 * @returns {string} Markdown string
 */
function serializeDocumentToMarkdown(doc) {
  if (!doc || !doc.blocks || !Array.isArray(doc.blocks)) {
    return '';
  }

  const markdownLines = [];

  for (let i = 0; i < doc.blocks.length; i++) {
    const block = doc.blocks[i];

    // Add blank line between blocks (except before first block)
    if (i > 0) {
      markdownLines.push('');
    }

    switch (block.type) {
      case 'heading':
        const level = Math.min(Math.max(1, block.level || 1), 6);
        const headingPrefix = '#'.repeat(level);
        markdownLines.push(`${headingPrefix} ${block.text || ''}`);
        break;

      case 'image':
        const alt = block.caption || '';
        let src = block.src || '';
        // If src is a data URL, extract just the base64 part for Markdown
        // The Markdown will be converted back to data URL when rendering
        if (src.startsWith('data:image/')) {
          // For Markdown, we'll store the full data URL
          // This allows round-trip preservation
          src = src;
        }
        markdownLines.push(`![${alt}](${src})`);
        break;

      case 'rawhtml':
        // Raw HTML blocks round-trip safely
        markdownLines.push(block.html || '');
        break;

      case 'paragraph':
      default:
        // Paragraph blocks are plain text
        const text = block.text || '';
        if (text) {
          markdownLines.push(text);
        }
        break;
    }
  }

  return markdownLines.join('\n');
}

/**
 * Render Document to DOM elements
 * 
 * Creates DOM nodes for each block type:
 * - Paragraph → <p>
 * - Heading → <h1>...<h6>
 * - Image → <img> with optional <figcaption>
 * - RawHTML → dangerouslySetInnerHTML
 * 
 * @param {Document} doc - Document to render
 * @param {HTMLElement} container - Container element to render into
 * @param {Object} options - Rendering options
 * @param {boolean} options.contentEditable - Whether blocks should be editable
 * @param {Function} options.onBlockUpdate - Callback when block content changes
 */
function renderDocument(doc, container, options = {}) {
  if (!doc || !doc.blocks || !Array.isArray(doc.blocks)) {
    return;
  }

  const { contentEditable = false, onBlockUpdate = null } = options;

  // Clear container
  container.innerHTML = '';

  doc.blocks.forEach((block, index) => {
    let element = null;

    switch (block.type) {
      case 'heading':
        const level = Math.min(Math.max(1, block.level || 1), 6);
        element = document.createElement(`h${level}`);
        element.textContent = block.text || '';
        element.setAttribute('data-block-id', block.id);
        element.setAttribute('data-block-type', 'heading');
        element.setAttribute('data-block-index', index.toString());
        if (contentEditable) {
          element.contentEditable = 'true';
        }
        break;

      case 'image':
        element = document.createElement('figure');
        element.setAttribute('data-block-id', block.id);
        element.setAttribute('data-block-type', 'image');
        element.setAttribute('data-block-index', index.toString());
        element.className = 'stack-image-block';
        // Images are NOT contenteditable - they are block-level elements
        element.contentEditable = false;
        
        const img = document.createElement('img');
        img.src = block.src || '';
        img.alt = block.caption || '';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.margin = '0 auto';
        element.appendChild(img);

        // Caption is optional and hidden unless image is selected
        if (block.caption) {
          const figcaption = document.createElement('figcaption');
          figcaption.className = 'stack-image-caption';
          figcaption.textContent = block.caption;
          figcaption.style.display = 'none'; // Hidden by default
          element.appendChild(figcaption);
        }
        break;

      case 'rawhtml':
        element = document.createElement('div');
        element.setAttribute('data-block-id', block.id);
        element.setAttribute('data-block-type', 'rawhtml');
        element.setAttribute('data-block-index', index.toString());
        element.innerHTML = block.html || '';
        if (contentEditable) {
          element.contentEditable = 'true';
        }
        break;

      case 'paragraph':
      default:
        element = document.createElement('p');
        const paragraphText = block.text || '';
        // Use textContent for empty paragraphs to ensure they're editable
        if (paragraphText === '') {
          element.textContent = '';
          // Add a zero-width space to make empty paragraphs editable
          element.appendChild(document.createTextNode('\u200B'));
        } else {
          element.textContent = paragraphText;
        }
        element.setAttribute('data-block-id', block.id);
        element.setAttribute('data-block-type', 'paragraph');
        element.setAttribute('data-block-index', index.toString());
        if (contentEditable) {
          element.contentEditable = 'true';
        }
        break;
    }

    if (element) {
      container.appendChild(element);
    }
  });
}

module.exports = {
  parseMarkdownToDocument,
  serializeDocumentToMarkdown,
  renderDocument,
  generateBlockId
};

