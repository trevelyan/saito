const CreatePostTemplate = require('./create-post.template');
const { parseMarkdownToDocument, serializeDocumentToMarkdown, renderDocument, generateBlockId } = require('../post-document');

/**
 * ============================================================================
 * EDITOR STRUCTURAL INVARIANTS
 * ============================================================================
 * 
 * These invariants define the core semantics of the editor and must be
 * maintained by all code paths. Violations cause race conditions, stale state,
 * and unpredictable behavior.
 * 
 * 1. DOM IS SINGLE SOURCE OF TRUTH
 *    - During editing, the DOM is authoritative
 *    - JavaScript state is DERIVED from DOM, never authoritative
 *    - No parallel document/block model exists during live editing
 * 
 * 2. STRUCTURAL CHANGES ARE ENTER-AUTHORITATIVE
 *    - Structural block changes (headings, lists, blockquotes) occur ONLY on
 *      Enter keydown events
 *    - input events may change text content but MUST NOT change block structure
 *    - This ensures deterministic behavior and prevents race conditions
 * 
 * 3. SELECTION/RANGE ARE VOLATILE
 *    - Selection and Range objects become stale after any DOM mutation
 *    - They must be re-read immediately before use, never cached across
 *      DOM changes
 *    - Early capture and reuse causes incorrect cursor positions
 * 
 * 4. NORMALIZATION VS COMPLETION
 *    - Normalization (block type conversion) never creates sibling blocks
 *    - Normalization updates focusedBlock and blockType in place
 *    - Enter completion always creates sibling blocks (new paragraphs/list items)
 *    - These are separate phases that must not be conflated
 * 
 * 5. ENTER COMPLETION IS MANDATORY
 *    - Every Enter keypress must result in exactly one structural change
 *    - Normalization must NOT return early or consume the Enter action
 *    - Enter completion logic always runs after normalization
 *    - Early returns after normalization are forbidden
 * 
 * 6. NO STRUCTURAL CONVERSION OUTSIDE handleEnterKey()
 *    - checkAutoConversion() is a no-op (structural conversion removed)
 *    - All structural conversion happens in handleEnterKey() only
 *    - This prevents race conditions and empty blocks during typing
 * 
 * ============================================================================
 */

class CreatePost {
  constructor(app, mod, container = "") {
    this.app = app;
    this.mod = mod;
    this.container = container;
    
    // ========================================================================
    // CONFIGURABLE SAVE THRESHOLDS
    // ========================================================================
    // Resolve save thresholds from module config or use defaults
    // Module can optionally set: mod.save_after_inactivity, mod.save_after_bytes, mod.save_after_editing
    const DEFAULT_SAVE_AFTER_INACTIVITY = 1500; // ms
    const DEFAULT_SAVE_AFTER_BYTES = 300; // characters
    const DEFAULT_SAVE_AFTER_EDITING = 30000; // ms (30 seconds)
    
    this.save_after_inactivity = (typeof mod.save_after_inactivity === 'number') 
      ? mod.save_after_inactivity 
      : DEFAULT_SAVE_AFTER_INACTIVITY;
    this.save_after_bytes = (typeof mod.save_after_bytes === 'number') 
      ? mod.save_after_bytes 
      : DEFAULT_SAVE_AFTER_BYTES;
    this.save_after_editing = (typeof mod.save_after_editing === 'number') 
      ? mod.save_after_editing 
      : DEFAULT_SAVE_AFTER_EDITING;
    
    // Save state tracking
    this.serializeTimeout = null;
    this.inactivityTimeout = null;
    this.editingTimer = null;
    this.editingStartTime = null;
    this.lastSaveContent = null; // Track content at last save
    this.lastTrackedContent = null; // Track content from last scheduleSerialization call (for incremental tracking)
    this.changedBytes = 0; // Track total bytes changed since last save
    this.isSaving = false; // Track if save is in-flight
    this.queuedSave = false; // Track if save is queued (editor became dirty during save)
    this.isComposing = false; // Track IME composition state
    
    this.saveState = 'draft'; // 'draft', 'saving', 'saved'
    this.saveStateTimeout = null;
    this.savingStartTime = null; // Track when saving started (for minimum visibility guarantee)
    this.storedDropRange = null; // Store Range for drop position (legacy)
    this.storedInsertionPoint = null; // Store insertion point that matches visual indicator (single source of truth)
    this.isDragging = false; // Track drag state
    this.isPublished = false; // Track if post is published
    this.draftTransaction = null; // Track current draft transaction (unsigned, saved to localhost)
    this.eventsAttached = false; // Track if event listeners have been attached (prevents double attachment)
    this.sessionIntent = null; // Session intent: { mode: 'resume'|'select'|'new', draftId?: string }
    this.activeDraftId = null; // Active draft ID for this session (bound to autosave)
    this.featuredImage = null; // Featured/teaser image (base64 data, stored in tx.msg.image)
  }

  render(container = "") {
    // ========================================================================
    // INVARIANT 4: Unmount before re-entering editor (navigation path: editor → editor)
    // ========================================================================
    // If editor is already mounted, unmount first to clean up timers/state
    if (this.isEditorMounted()) {
      this.onEditorUnmount();
    }

    // ========================================================================
    // LIFECYCLE: Reset ALL session-local state for fresh editing session
    // ========================================================================
    // CreatePost is long-lived, so we must explicitly reset all session state
    // on every mount, regardless of previous session state
    this.resetSessionState();

    if (container !== "") {
      this.container = container;
    }

    if (!this.container || this.container.trim() === "") {
      this.container = ".saito-container";
    }

    const html = CreatePostTemplate(this.app, this.mod);

    // ========================================================================
    // FIX: Use replaceElementContentBySelector to preserve .saito-container
    // ========================================================================
    // replaceElementBySelector replaces the container itself (obj.outerHTML = html)
    // This causes .saito-container to disappear, breaking mount verification.
    // Use replaceElementContentBySelector to replace only the inner content,
    // preserving the container element so mount verification works correctly.
    this.app.browser.replaceElementContentBySelector(html, this.container);

    // Update container class
    const containerEl = document.querySelector(this.container);
    if (containerEl) {
      containerEl.classList.remove('stack-splash-container');
      containerEl.classList.add('stack-create-post-container');
    }

    // Trigger mount transition on next animation frame
    // This allows the initial state (opacity: 0) to render first
    requestAnimationFrame(() => {
      const pageEl = document.querySelector('.stack-create-post-page');
      if (pageEl) {
        pageEl.classList.add('stack-create-post-page-mounted');
      }
    });

    // ========================================================================
    // LIFECYCLE: Initialize document and mount editor
    // ========================================================================
    // Mount happens FIRST (infrastructure), draft loading happens SECOND (data)
    // Draft loading must NOT suppress mount - mount is independent of draft state
    this.initializeDocument().then(() => {
      this.onEditorMount();
      // Update featured image display after mount (in case draft was loaded)
      setTimeout(() => {
        this.updateFeaturedImageDisplay();
      }, 100);
    }).catch(err => {
      console.error('Stack: Error initializing document:', err);
      // Even if document initialization fails, attempt mount (infrastructure must be ready)
      this.onEditorMount();
      setTimeout(() => {
        this.updateFeaturedImageDisplay();
      }, 100);
    });
  }

  /**
   * Initialize document based on explicit session intent
   * 
   * SESSION INTENT OBJECT: { mode: 'resume'|'select'|'new', draftId?: string }
   * 
   * Branching logic:
   * - mode: 'new' → Initialize empty editor (draft created lazily on first edit)
   * - mode: 'resume' → Load draft by draftId (most recent draft)
   * - mode: 'select' → Load draft by draftId (specific draft from chooser)
   * 
   * If no intent is provided, shows draft chooser overlay and waits for user choice.
   * 
   * NOTE: Does NOT attach event listeners - that happens in onEditorMount()
   */
  async initializeDocument(sessionIntent = null) {
    const editor = document.querySelector('#stack-post-body-editor');
    if (!editor) {
      return;
    }

    // ========================================================================
    // SESSION INTENT: Use provided intent or show chooser
    // ========================================================================
    if (!sessionIntent) {
      // ========================================================================
      // CRASH/RELOAD SAFETY: No sessionIntent means unsafe state - show chooser
      // ========================================================================
      console.warn('[EDITOR-INVARIANT] initializeDocument() called without sessionIntent - forcing chooser display');
      
      // No intent provided: discover drafts and show chooser
    if (this.mod.discoverDrafts) {
      await this.mod.discoverDrafts();
    }
    
    const drafts = this.mod.getDrafts && this.mod.getDrafts();
    const draftCount = drafts ? drafts.length : 0;

      // ========================================================================
      // FOURTH-DRAFT PREVENTION: If 3 drafts exist, load most recent draft
      // ========================================================================
      // This ensures closing the overlay reveals the draft, NOT an empty editor
      // Only allow initializeEmptyEditor() when draftCount < 3
      if (draftCount >= 3) {
        const mostRecentDraft = drafts[0];
        if (mostRecentDraft && mostRecentDraft.id) {
          // Load most recent draft behind the overlay
          this.activeDraftId = mostRecentDraft.id;
          await this.loadDraftById(mostRecentDraft.id);
        }
      }

      // Always show chooser overlay
      await this.showDraftChooserOverlay();
      // Chooser will call initializeDocument() with intent when dismissed
      return;
    }

    // Store session intent for this session
    this.sessionIntent = sessionIntent;
    
    // ========================================================================
    // [EDITOR-INVARIANT] Log session start for validation
    // ========================================================================
    console.debug('[EDITOR-INVARIANT] Session started:', JSON.stringify(sessionIntent));
    
    // ========================================================================
    // BRANCH ON INTENT: Initialize editor based solely on intent object
    // ========================================================================
    if (sessionIntent.mode === 'new') {
      // Mode: new - Initialize empty editor, draft created lazily on first edit
      // BUT: Only allow if fewer than 3 drafts exist (hard cap)
      const drafts = this.mod.getDrafts && this.mod.getDrafts();
      const draftCount = drafts ? drafts.length : 0;
      
      if (draftCount >= 3) {
        console.warn('[EDITOR-INVARIANT] initializeEmptyEditor() prevented - 3 drafts already exist. Loading most recent draft instead.');
        // Fallback to most recent draft instead of creating empty editor
        const mostRecentDraft = drafts[0];
        if (mostRecentDraft && mostRecentDraft.id) {
          this.activeDraftId = mostRecentDraft.id;
          await this.loadDraftById(mostRecentDraft.id);
    } else {
          // Should not happen, but handle gracefully
          this.activeDraftId = null;
          this.initializeEmptyEditor();
        }
      } else {
        this.activeDraftId = null;
        this.initializeEmptyEditor();
      }
    } else if (sessionIntent.mode === 'resume' || sessionIntent.mode === 'select') {
      // Mode: resume or select - Load specified draft
      if (!sessionIntent.draftId) {
        console.error('Stack: initializeDocument() called with resume/select mode but no draftId');
        this.initializeEmptyEditor();
        return;
      }
      
      this.activeDraftId = sessionIntent.draftId;
      
      // ========================================================================
      // [EDITOR-INVARIANT] Log draft bind for validation
      // ========================================================================
      console.debug('[EDITOR-INVARIANT] Draft bound to session:', sessionIntent.draftId);
      
      await this.loadDraftById(sessionIntent.draftId);
    } else {
      console.error('Stack: initializeDocument() called with invalid session intent mode:', sessionIntent.mode);
      this.initializeEmptyEditor();
      return;
    }
    
    // ========================================================================
    // INVARIANT CHECK: Verify session state after initialization
    // ========================================================================
    try {
      this.assertValidSessionIntent('after initializeDocument');
      this.assertActiveDraftConsistency('after initializeDocument');
    } catch (error) {
      console.error('[EDITOR-INVARIANT] Session state invariant violation after initialization:', error);
      // Continue - session may still be usable
    }
    
    // Ensure placeholder is shown if editor is empty
    this.updatePlaceholderVisibility();
    
    // Initialize save state
    this.updateSaveState('draft');
    
    // Update next step button state
    this.updateNextStepButton();
    
    // Update publish trigger visibility
    this.updatePublishTriggerVisibility();
    this.updatePublishTriggerState();
    
    // NOTE: Event listeners are attached in onEditorMount() after mount verification
    
    // Auto-focus title input on load if no content exists
    setTimeout(() => {
      const titleInput = document.querySelector('#stack-post-title-input');
      const editor = document.querySelector('#stack-post-body-editor');
      
      // Check if there's any existing content (read from DOM)
      const hasTitle = titleInput && titleInput.value.trim().length > 0;
      const hasBodyContent = editor && Array.from(editor.querySelectorAll('[data-block-id]')).some(blockEl => {
        const blockType = blockEl.getAttribute('data-block-type');
        if (blockType === 'paragraph' || blockType === 'heading' || blockType === 'list-item' || blockType === 'blockquote') {
          const text = (blockEl.textContent || '').replace(/\u200B/g, '').trim();
          return text.length > 0;
        }
        if (blockType === 'image') {
          return true;
        }
        if (blockType === 'rawhtml') {
          return (blockEl.innerHTML || '').trim().length > 0;
        }
        return false;
      });
      
      // If no content exists, focus title input
      if (!hasTitle && !hasBodyContent && titleInput) {
        titleInput.focus();
      } else if (editor && hasBodyContent) {
        // If body has content, focus body editor
        const firstBlock = editor.querySelector('[contenteditable="true"]');
        if (firstBlock) {
          const range = document.createRange();
          const selection = window.getSelection();
          
          // Ensure the block has a text node for cursor placement
          if (!firstBlock.firstChild || firstBlock.firstChild.nodeType !== Node.TEXT_NODE) {
            const textNode = document.createTextNode('\u200B');
            firstBlock.appendChild(textNode);
          }
          
          // Place cursor at the start of the text node
          if (firstBlock.firstChild && firstBlock.firstChild.nodeType === Node.TEXT_NODE) {
            range.setStart(firstBlock.firstChild, 0);
            range.setEnd(firstBlock.firstChild, 0);
            range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          }
        }
      }
    }, 50);
  }

  /**
   * Show the draft chooser overlay
   * Only called when draftCount > 0
   * Editor should already be rendered with most recent draft behind the overlay
   */
  async showDraftChooserOverlay() {
    // ========================================================================
    // DIAGNOSTIC: Log when showDraftChooserOverlay() is called
    // ========================================================================
    console.log('[DIAG] showDraftChooserOverlay() CALLED');
    
    // Lazy-load overlay if needed
    if (!this.mod.chooseDraftOverlay) {
      const ChooseDraftOverlay = require('./overlay/choose-draft');
      this.mod.chooseDraftOverlay = new ChooseDraftOverlay(this.app, this.mod);
      console.log('[DIAG] showDraftChooserOverlay() Lazy-loaded ChooseDraftOverlay');
    }

    // Small delay to ensure editor is fully rendered behind overlay
    setTimeout(async () => {
      console.log('[DIAG] showDraftChooserOverlay() About to call overlay.render()');
      await this.mod.chooseDraftOverlay.render();
      console.log('[DIAG] showDraftChooserOverlay() overlay.render() completed');
    }, 100);
  }

  /**
   * ========================================================================
   * LIFECYCLE: RESET SESSION STATE
   * ========================================================================
   * 
   * Resets ALL session-local state for a fresh editing session.
   * Called at the start of render() to ensure clean state regardless of:
   * - prior navigation
   * - prior publish
   * - crash recovery
   * - draft chooser re-entry
   * 
   * DO NOT rely on constructor defaults - CreatePost is long-lived.
   */
  resetSessionState() {
    // ========================================================================
    // TEMP: Log session reset for validation
    // ========================================================================
    console.debug('[TEMP] CreatePost: resetSessionState() called - starting fresh session');

    // Publishing state - MUST be reset (publish must not poison future sessions)
    this.isPublished = false;
    this.draftTransaction = null;
    this.sessionIntent = null;
    this.activeDraftId = null;

    // Drag/drop state
    this.isDragging = false;
    this.storedDropRange = null;
    this.storedInsertionPoint = null;

    // Timer state - cancel any existing timers (defensive)
    if (this.serializeTimeout) {
      clearTimeout(this.serializeTimeout);
      this.serializeTimeout = null;
    }
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }
    if (this.editingTimer) {
      clearTimeout(this.editingTimer);
      this.editingTimer = null;
    }
    if (this.saveStateTimeout) {
      clearTimeout(this.saveStateTimeout);
      this.saveStateTimeout = null;
    }

    // Editing/saving state
    this.editingStartTime = null;
    this.lastSaveContent = null;
    this.lastTrackedContent = null;
    this.changedBytes = 0;
    this.isSaving = false;
    this.queuedSave = false;
    this.isComposing = false;
    this.saveState = 'draft';
    this.savingStartTime = null;

    // Event listener attachment flag (prevents double attachment)
    this.eventsAttached = false;
  }

  /**
   * ========================================================================
   * LIFECYCLE: MOUNT BOUNDARY
   * ========================================================================
   * 
   * "Mounted" means all three required elements exist:
   * - .saito-container exists
   * - #stack-post-body-editor exists
   * - #stack-post-title-input exists
   * 
   * Mount verification must happen BEFORE attaching event listeners.
   */
  isEditorMounted() {
    const container = document.querySelector(this.container || '.saito-container');
    const editor = document.querySelector('#stack-post-body-editor');
    const titleInput = document.querySelector('#stack-post-title-input');
    
    return !!(container && editor && titleInput);
  }

  /**
   * ========================================================================
   * INVARIANT ASSERTIONS: Defensive hardening helpers
   * ========================================================================
   * 
   * These helpers detect invariant violations early and fail loudly.
   * They prevent silent bugs and make refactoring safer.
   */

  /**
   * Assert that editor is mounted
   * Fails loudly if editor DOM elements are missing
   */
  assertEditorMounted(context = '') {
    if (!this.isEditorMounted()) {
      const msg = `[EDITOR-INVARIANT] Editor must be mounted${context ? ` (${context})` : ''}`;
      console.error(msg);
      throw new Error(msg);
    }
  }

  /**
   * Assert that session intent is valid
   * Fails loudly if sessionIntent is missing or invalid
   */
  assertValidSessionIntent(context = '') {
    if (!this.sessionIntent) {
      const msg = `[EDITOR-INVARIANT] sessionIntent must be defined${context ? ` (${context})` : ''}`;
      console.error(msg);
      throw new Error(msg);
    }

    const validModes = ['new', 'resume', 'select'];
    if (!validModes.includes(this.sessionIntent.mode)) {
      const msg = `[EDITOR-INVARIANT] Invalid sessionIntent.mode: ${this.sessionIntent.mode}${context ? ` (${context})` : ''}`;
      console.error(msg);
      throw new Error(msg);
    }

    // If mode is 'resume' or 'select', draftId must be present
    if ((this.sessionIntent.mode === 'resume' || this.sessionIntent.mode === 'select') && !this.sessionIntent.draftId) {
      const msg = `[EDITOR-INVARIANT] sessionIntent.draftId required for mode '${this.sessionIntent.mode}'${context ? ` (${context})` : ''}`;
      console.error(msg);
      throw new Error(msg);
    }
  }

  /**
   * Assert that active draft ID is consistent with session intent
   * Fails loudly if activeDraftId state is invalid
   */
  assertActiveDraftConsistency(context = '') {
    if (!this.sessionIntent) {
      // No intent means no active session - skip check
      return;
    }

    if (this.sessionIntent.mode === 'new') {
      // New sessions should have activeDraftId = null initially
      // (draft created lazily on first edit)
      if (this.activeDraftId !== null && this.draftTransaction === null) {
        const msg = `[EDITOR-INVARIANT] activeDraftId should be null for 'new' session without draftTransaction${context ? ` (${context})` : ''}`;
        console.error(msg);
        // Don't throw - this can happen legitimately after first save
      }
    } else if (this.sessionIntent.mode === 'resume' || this.sessionIntent.mode === 'select') {
      // Resume/select sessions must have activeDraftId matching sessionIntent.draftId
      if (this.activeDraftId !== this.sessionIntent.draftId) {
        const msg = `[EDITOR-INVARIANT] activeDraftId (${this.activeDraftId}) must match sessionIntent.draftId (${this.sessionIntent.draftId})${context ? ` (${context})` : ''}`;
        console.error(msg);
        // Don't throw - this can be set during draft loading
      }
    }
  }

  /**
   * ========================================================================
   * LIFECYCLE: EDITOR MOUNT
   * ========================================================================
   * 
   * Called after DOM is ready and initializeDocument() has completed.
   * Verifies mount boundary, then attaches event listeners exactly once.
   * 
   * This ensures event listeners are only attached when editor is fully ready
   * and prevents double attachment.
   */
  onEditorMount() {
    // ========================================================================
    // TEMP: Log mount attempt for validation
    // ========================================================================
    console.debug('[TEMP] CreatePost: onEditorMount() called');

    // Verify mount boundary before proceeding
    if (!this.isEditorMounted()) {
      console.error('Stack: onEditorMount() called but editor is not mounted. Required elements missing.');
      // Retry after a short delay (DOM might not be ready yet)
      setTimeout(() => {
        if (this.isEditorMounted()) {
          this.onEditorMount();
        } else {
          console.error('Stack: Editor mount failed after retry. Editor elements still missing.');
        }
      }, 50);
      return;
    }

    // ========================================================================
    // INVARIANT CHECK: Guard against double attachment
    // ========================================================================
    if (this.eventsAttached) {
      console.warn('[EDITOR-INVARIANT] onEditorMount() called but events already attached. Skipping.');
      return;
    }

    // ========================================================================
    // [EDITOR-INVARIANT] Log successful mount for validation
    // ========================================================================
    console.debug('[EDITOR-INVARIANT] Mount verified, attaching event listeners');

    // Mount verified - attach event listeners exactly once
    this.attachEvents();
    this.eventsAttached = true;

    // ========================================================================
    // [EDITOR-INVARIANT] Log mount completion for validation
    // ========================================================================
    console.debug('[EDITOR-INVARIANT] Mount complete, event listeners attached');
  }

  /**
   * ========================================================================
   * LIFECYCLE: EDITOR UNMOUNT
   * ========================================================================
   * 
   * Called before navigating away from the editor.
   * Cancels all timers and cleans up state to prevent leaks.
   * 
   * Must be called before:
   * - Navigating to splash
   * - Navigating to viewer
   * - Navigating to explore
   * - Re-entering editor (another render() call)
   */
  onEditorUnmount() {
    // Cancel all timers
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }
    if (this.serializeTimeout) {
      clearTimeout(this.serializeTimeout);
      this.serializeTimeout = null;
    }
    if (this.saveStateTimeout) {
      clearTimeout(this.saveStateTimeout);
      this.saveStateTimeout = null;
    }
    if (this.editingTimer) {
      clearTimeout(this.editingTimer);
      this.editingTimer = null;
    }

    // Reset editing state
    this.editingStartTime = null;
    this.queuedSave = false;
    this.isComposing = false;
    this.savingStartTime = null; // Reset saving start time on unmount
    
    // Reset event attachment flag so events can be re-attached on next mount
    this.eventsAttached = false;
    
    // Note: We do NOT reset isPublished or draftTransaction here
    // Those are reset in resetSessionState() at the start of render() to ensure fresh session state
  }

  /**
   * Serialize DOM directly to markdown
   * DOM is the single source of truth during editing
   * 
   * PUBLISH-TIME INVARIANT: This method reads directly from the live DOM.
   * It does NOT use cached state, draft snapshots, or autosave output.
   * What the user sees in the editor is exactly what gets serialized.
   */
  serializeDOMToMarkdown(imageIdMap = null) {
    const editor = document.querySelector('#stack-post-body-editor');
    if (!editor) return '';

    const markdownLines = [];
    const blockElements = Array.from(editor.querySelectorAll('[data-block-id]'));

    for (let i = 0; i < blockElements.length; i++) {
      const blockEl = blockElements[i];
      const blockType = blockEl.getAttribute('data-block-type');

      // Add blank line between blocks (except before first block)
      if (i > 0) {
        markdownLines.push('');
      }

      switch (blockType) {
        case 'heading':
          const level = parseInt(blockEl.tagName.charAt(1)) || 1;
          const headingText = (blockEl.textContent || '').replace(/\u200B/g, '').trim();
          const headingPrefix = '#'.repeat(level);
          markdownLines.push(`${headingPrefix} ${headingText}`);
          break;

        case 'image':
          const img = blockEl.querySelector('img');
          const captionEl = blockEl.querySelector('.stack-image-caption');
          const alt = captionEl ? captionEl.textContent : '';
          
          // If imageIdMap is provided (publish-time), use image reference
          // Otherwise (autosave), preserve original src for draft recovery
          if (imageIdMap && img && img.src) {
            // Find the imageId for this image src in the map
            const imageId = imageIdMap.get(img.src);
            if (imageId) {
              markdownLines.push(`![${alt}](stack:image:${imageId})`);
            } else {
              // Fallback: if no ID found, use original src (should not happen)
              markdownLines.push(`![${alt}](${img.src})`);
            }
          } else {
            // Draft serialization: preserve original src
          const src = img ? img.src : '';
          markdownLines.push(`![${alt}](${src})`);
          }
          break;

        case 'code':
          // Code blocks: <pre> with data-block-type="code"
          // Serialize as markdown code fence (```)
          const codeText = (blockEl.textContent || '').replace(/\u200B/g, '');
          markdownLines.push('```');
          markdownLines.push(codeText);
          markdownLines.push('```');
          break;

        case 'rawhtml':
          const htmlContent = blockEl.innerHTML || '';
          markdownLines.push(htmlContent);
          break;

        case 'paragraph':
        case 'list-item':
        case 'blockquote':
        default:
          // Paragraph, list-item, and blockquote are plain text
          const text = (blockEl.textContent || '').replace(/\u200B/g, '').trim();
          if (text) {
            markdownLines.push(text);
          }
          break;
      }
    }

    return markdownLines.join('\n');
  }

  /**
   * Check if editor has meaningful content and update placeholder visibility
   * Reads directly from DOM (single source of truth)
   */
  updatePlaceholderVisibility() {
    const editor = document.querySelector('#stack-post-body-editor');
    if (!editor) return;

    // Check if there's any meaningful content (read from DOM)
    const blockElements = editor.querySelectorAll('[data-block-id]');
    let hasContent = false;

    for (const blockEl of blockElements) {
      const blockType = blockEl.getAttribute('data-block-type');
      
      if (blockType === 'paragraph' || blockType === 'heading' || blockType === 'list-item' || blockType === 'blockquote') {
        const text = (blockEl.textContent || '').replace(/\u200B/g, '').trim();
        if (text.length > 0) {
          hasContent = true;
          break;
        }
      } else if (blockType === 'image') {
        hasContent = true; // Images count as content
        break;
      } else if (blockType === 'rawhtml') {
        const html = (blockEl.innerHTML || '').trim();
        if (html.length > 0) {
          hasContent = true;
          break;
        }
      }
    }

    // Toggle placeholder class
    if (hasContent) {
      editor.classList.remove('stack-editor-empty');
    } else {
      editor.classList.add('stack-editor-empty');
    }
  }

  /**
   * Schedule debounced serialization with configurable thresholds
   * Serializes directly from DOM (single source of truth)
   * 
   * Save triggers when ANY of:
   * 1) User stops editing for save_after_inactivity ms
   * 2) Total changed characters >= save_after_bytes
   * 3) Continuous editing time >= save_after_editing ms
   * 
   * Additional rules:
   * - Only ONE save may be in-flight at a time
   * - If editor becomes dirty during save, queue ONE follow-up save
   * - Do NOT save during IME composition
   * - Do NOT save during publish flow
   */
  scheduleSerialization() {
    // Skip if published, composing, or during publish flow
    if (this.isPublished || this.isComposing) {
      return;
    }

    // Get current content to track changes
    const currentContent = this.serializeDOMToMarkdown();
    const title = document.querySelector('#stack-post-title-input')?.value || '';
    const fullContent = title + currentContent;
    
    // Calculate bytes changed since last save (incremental tracking)
    if (this.lastTrackedContent !== null) {
      // Track incremental change from last call to scheduleSerialization
      const lastLength = this.lastTrackedContent.length;
      const currentLength = fullContent.length;
      const delta = Math.abs(currentLength - lastLength);
      this.changedBytes += delta;
    } else if (this.lastSaveContent !== null) {
      // First call after a save - compare to last saved content
      const lastLength = this.lastSaveContent.length;
      const currentLength = fullContent.length;
      const delta = Math.abs(currentLength - lastLength);
      this.changedBytes = delta;
    } else {
      // First time ever - don't count initial content as "changed"
      this.changedBytes = 0;
    }
    
    // Update tracked content for next comparison
    this.lastTrackedContent = fullContent;
    
    // Start editing timer if not already started
    if (this.editingStartTime === null) {
      this.editingStartTime = Date.now();
    }
    
    // Check if we should save immediately (bytes threshold)
    if (this.changedBytes >= this.save_after_bytes) {
      this.triggerSave();
      return;
    }
    
    // Check if we should save due to continuous editing time
    if (this.editingStartTime !== null) {
      const editingDuration = Date.now() - this.editingStartTime;
      if (editingDuration >= this.save_after_editing) {
        this.triggerSave();
        return;
      }
    }
    
    // Clear existing inactivity timeout
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
    }
    
    // Schedule save after inactivity period
    this.inactivityTimeout = setTimeout(() => {
      this.triggerSave();
    }, this.save_after_inactivity);
  }
  
  /**
   * Trigger save operation
   * Ensures only one save in-flight, queues follow-up if needed
   * 
   * INVARIANT: During normal typing, isEditorMounted() MUST be true.
   * If false, that indicates a lifecycle bug - log it and abort.
   */
  async triggerSave() {
    // ========================================================================
    // [EDITOR-INVARIANT] Log autosave start for validation
    // ========================================================================
    console.debug('[EDITOR-INVARIANT] Autosave started');

    // ========================================================================
    // INVARIANT CHECK: Editor must be mounted
    // ========================================================================
    if (!this.isEditorMounted()) {
      console.error('[EDITOR-INVARIANT] triggerSave() called but editor is not mounted. Aborting save.');
      return;
    }

    // ========================================================================
    // INVARIANT CHECK: Session intent must be valid
    // ========================================================================
    if (!this.sessionIntent) {
      console.error('[EDITOR-INVARIANT] triggerSave() called without sessionIntent. Aborting save.');
      return;
    }

    // ========================================================================
    // INVARIANT CHECK: Autosave must not run after publish
    // ========================================================================
    if (this.isPublished) {
      console.error('[EDITOR-INVARIANT] triggerSave() called after publish. Autosave must not run. Aborting save.');
      return;
    }

    // ========================================================================
    // INVARIANT CHECK: Active draft consistency (for resume/select sessions)
    // ========================================================================
    if (this.sessionIntent.mode !== 'new') {
      // For resume/select sessions, activeDraftId should match sessionIntent.draftId
      if (this.activeDraftId !== this.sessionIntent.draftId) {
        console.error('[EDITOR-INVARIANT] triggerSave() called with mismatched activeDraftId. Expected:', this.sessionIntent.draftId, 'Got:', this.activeDraftId);
        // Continue - draft may be in loading state
      }
    }

    // If save is already in progress, queue a follow-up
    if (this.isSaving) {
      this.queuedSave = true;
      return;
    }
    
    // Mark as saving and record start time (for minimum visibility guarantee)
    this.isSaving = true;
    this.savingStartTime = Date.now();
    this.updateSaveState('saving');
    
    // Clear all timers
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }
    if (this.serializeTimeout) {
      clearTimeout(this.serializeTimeout);
      this.serializeTimeout = null;
    }
    
    try {
      // Save draft to localhost archive
      await this.saveDraftTransaction();
      
      // Update last saved content
      const currentContent = this.serializeDOMToMarkdown();
      const title = document.querySelector('#stack-post-title-input')?.value || '';
      this.lastSaveContent = title + currentContent;
      this.lastTrackedContent = this.lastSaveContent; // Reset tracked content to saved content
      
      // Reset change tracking
      this.changedBytes = 0;
      this.editingStartTime = null;
      
      // ========================================================================
      // GUARANTEE: Minimum 500ms "Saving…" visibility
      // ========================================================================
      // Calculate how long we've been showing "Saving…"
      const elapsed = Date.now() - this.savingStartTime;
      const minVisibilityMs = 500;
      const remainingTime = Math.max(0, minVisibilityMs - elapsed);
      
      // Update state back to "draft" after minimum visibility period
      if (this.saveStateTimeout) {
        clearTimeout(this.saveStateTimeout);
      }
      this.saveStateTimeout = setTimeout(() => {
        this.updateSaveState('draft');
        this.savingStartTime = null;
      }, remainingTime);
      
      // Check if a save was queued while we were saving
      if (this.queuedSave) {
        this.queuedSave = false;
        // Schedule another save if content changed during save
        this.scheduleSerialization();
      }
    } catch (error) {
      console.error('Stack: Error saving draft:', error);
      // On error, still enforce minimum visibility before showing "Draft"
      const elapsed = Date.now() - (this.savingStartTime || Date.now());
      const minVisibilityMs = 500;
      const remainingTime = Math.max(0, minVisibilityMs - elapsed);
      
      if (this.saveStateTimeout) {
        clearTimeout(this.saveStateTimeout);
      }
      this.saveStateTimeout = setTimeout(() => {
      this.updateSaveState('draft');
        this.savingStartTime = null;
      }, remainingTime);
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Initialize empty editor (no draft loaded)
   * Called when session intent mode is 'new'
   * Draft transaction will be created lazily on first edit via triggerSave()
   */
  initializeEmptyEditor() {
    const editor = document.querySelector('#stack-post-body-editor');
    const titleInput = document.querySelector('#stack-post-title-input');
    
    if (!editor || !titleInput) return;

    // Clear title
    titleInput.value = '';
    
    // Create empty document
    const tempDocument = { blocks: [{ type: 'paragraph', id: generateBlockId(0), text: '' }] };
    renderDocument(tempDocument, editor, {
      contentEditable: true
    });

    // Clear draft transaction reference (new draft, no transaction yet)
    this.draftTransaction = null;

    // Update UI state
    this.updatePlaceholderVisibility();
    this.updatePublishTriggerVisibility();
    this.updatePublishTriggerState();
    this.updateSaveState('draft');
  }

  /**
   * @deprecated Use initializeEmptyEditor() instead. Kept for backward compatibility with chooser.
   */
  createNewDraft() {
    this.initializeEmptyEditor();
  }

  /**
   * Load the most recent draft from localhost archive
   * Queries for field4 = "stack:draft", sorts by updated_at DESC, loads the first result
   */
  async loadMostRecentDraft() {
    try {
      return new Promise((resolve) => {
        this.app.storage.loadTransactions(
          {
            field1: 'Stack',
            field4: 'stack:draft',
            limit: 100 // Load up to 100 drafts to sort
          },
          (txs) => {
            if (!txs || txs.length === 0) {
              resolve(null);
              return;
            }

            // Sort by updated_at DESC (most recent first)
            // Use tx.optional.updated_at if available, fallback to tx.timestamp
            txs.sort((a, b) => {
              const aTime = a.optional?.updated_at || a.timestamp || 0;
              const bTime = b.optional?.updated_at || b.timestamp || 0;
              return bTime - aTime; // DESC order
            });

            // Get the most recent draft (first in sorted array)
            const mostRecentDraft = txs[0];
            if (!mostRecentDraft) {
              resolve(null);
              return;
            }

            // Load the draft
            this.loadDraftTransaction(mostRecentDraft);

            resolve(mostRecentDraft);
          },
          'localhost' // Query localhost archive only
        );
      });
    } catch (error) {
      console.error('Error loading draft:', error);
      return null;
    }
  }

  /**
   * Load a draft by ID (signature or hash)
   * Queries for the specific draft transaction and loads it into the editor
   */
  async loadDraftById(draftId) {
    try {
      return new Promise((resolve) => {
        this.app.storage.loadTransactions(
          {
            field1: 'Stack',
            field4: 'stack:draft',
            limit: 100 // Load up to 100 drafts to search
          },
          (txs) => {
            if (!txs || txs.length === 0) {
              resolve(null);
              return;
            }

            // Find transaction by signature or hash
            const draft = txs.find(t => 
              t.signature === draftId || t.hash === draftId
            );

            if (!draft) {
              resolve(null);
              return;
            }

            // Load the draft
            this.loadDraftTransaction(draft);

            resolve(draft);
          },
          'localhost' // Query localhost archive only
        );
      });
    } catch (error) {
      console.error('Error loading draft by ID:', error);
      return null;
    }
  }

  /**
   * Internal helper to load a draft transaction into the editor
   * Populates title, content, and featured image from the transaction
   */
  loadDraftTransaction(tx) {
    // Extract data from transaction
    const msg = tx.returnMessage();
    const data = msg?.data || {};

    const title = data.title || '';
    const content = data.content || '';

    // Populate title input
    const titleInput = document.querySelector('#stack-post-title-input');
    if (titleInput) {
      titleInput.value = title;
    }

    // Populate body editor
    const editor = document.querySelector('#stack-post-body-editor');
    if (editor) {
      if (content.trim()) {
        // Parse markdown content to document structure
        const tempDocument = parseMarkdownToDocument(content);
        
        // Render document to editor
        renderDocument(tempDocument, editor, {
          contentEditable: true
        });
      } else {
        // Empty content - render empty document
        const tempDocument = { blocks: [{ type: 'paragraph', id: generateBlockId(0), text: '' }] };
        renderDocument(tempDocument, editor, {
          contentEditable: true
        });
      }
    }

    // Store reference to draft transaction and set active draft ID for this session
    this.draftTransaction = tx;
    this.activeDraftId = tx.signature || tx.hash || null;

    // Load featured image from draft if present
    if (data.image) {
      this.featuredImage = data.image; // Base64 data
      // Update display after a short delay to ensure DOM is ready
      setTimeout(() => {
        this.updateFeaturedImageDisplay();
      }, 50);
    } else {
      this.featuredImage = null;
      this.updateFeaturedImageDisplay();
    }

    // ========================================================================
    // [EDITOR-INVARIANT] Log draft bind after loading for validation
    // ========================================================================
    console.debug('[EDITOR-INVARIANT] Draft loaded and bound:', this.activeDraftId);

    // Update UI state
    this.updatePlaceholderVisibility();
    this.updatePublishTriggerVisibility();
    this.updatePublishTriggerState();
    this.updateSaveState('draft');
  }

  /**
   * Save or update draft transaction to localhost archive
   * Drafts are unsigned transactions saved with field4 = "stack:draft"
   * 
   * INVARIANT: This method must NEVER early-return due to stale state.
   * isPublished is ALWAYS false when entering the editor (reset in render()).
   * Publishing does NOT poison future editor sessions.
   */
  async saveDraftTransaction() {
    // ========================================================================
    // [EDITOR-INVARIANT] Log save attempt for validation
    // ========================================================================
    console.debug('[EDITOR-INVARIANT] saveDraftTransaction() called, activeDraftId:', this.activeDraftId);

    // ========================================================================
    // INVARIANT CHECK: Must not save after publish
    // ========================================================================
    if (this.isPublished) {
      console.error('[EDITOR-INVARIANT] saveDraftTransaction() called with isPublished=true. Autosave must not run after publish.');
      return; // Fail loudly - do not save
    }

    // ========================================================================
    // INVARIANT CHECK: Session intent must be valid
    // ========================================================================
    if (!this.sessionIntent) {
      console.error('[EDITOR-INVARIANT] saveDraftTransaction() called without sessionIntent. Aborting save.');
      return;
    }

    try {
      const title = document.querySelector('#stack-post-title-input')?.value || '';
      const content = this.serializeDOMToMarkdown();

      // Skip if both title and content are empty
      if (!title.trim() && !content.trim()) {
        console.log('[DIAG] saveDraftTransaction() EARLY RETURN: title and content are both empty');
        return;
      }

      // Get current draft transaction or create new one
      // If activeDraftId is set, we must load that draft (session-scoped)
      let tx = this.draftTransaction;

      if (!tx && this.activeDraftId) {
        // Session has activeDraftId but no draftTransaction - load it
        console.log('[DIAG] saveDraftTransaction() Loading existing draft for activeDraftId:', this.activeDraftId);
        const loadedDraft = await this.loadDraftById(this.activeDraftId);
        if (loadedDraft) {
          tx = this.draftTransaction;
        }
      }

      if (!tx) {
        console.log('[DIAG] saveDraftTransaction() Creating NEW draft transaction');
        // Create new unsigned transaction
        tx = await this.app.wallet.createUnsignedTransactionWithDefaultFee(this.mod.publicKey);
        
        // Set transaction message structure matching Stack post format
        const data = {
          type: 'stack_post',
          title: title.trim() || '',
          content: content.trim() || '',
          tags: [],
          image: this.featuredImage || '', // Featured/teaser image (singular, separate)
          imageUrl: '',
          timestamp: Date.now(),
          subscriptionTier: 'free',
          excerpt: ''
        };

        tx.msg = {
          module: 'Stack',
          request: 'create stack post request',
          data: data
        };

        // ========================================================================
        // DIAGNOSTIC: Log field4 value being saved
        // ========================================================================
        const field4Value = 'stack:draft';
        console.log('[DIAG] saveDraftTransaction() Saving NEW draft with field4 =', field4Value);

        // ========================================================================
        // DIAGNOSTIC: Log exact values being stored (field1, field2, field4, peer)
        // ========================================================================
        console.log('[DIAG] saveDraftTransaction() About to save with:');
        console.log('[DIAG]   - field1: (auto-populated from tx.msg.module, expected: "Stack")');
        console.log('[DIAG]   - field2: (auto-populated from tx.from[0].publicKey, expected:', this.mod.publicKey, ')');
        console.log('[DIAG]   - field4:', field4Value);
        console.log('[DIAG]   - peer: "localhost"');
        console.log('[DIAG]   - tx.msg.module =', JSON.stringify(tx.msg?.module), '(type:', typeof tx.msg?.module, ')');
        console.log('[DIAG]   - tx.from =', tx.from ? JSON.stringify(tx.from) : 'N/A');
        console.log('[DIAG]   - tx.from[0].publicKey =', tx.from && tx.from[0] ? JSON.stringify(tx.from[0].publicKey) : 'N/A');
        console.log('[DIAG]   - tx.signature =', tx.signature || 'N/A (unsigned transaction - signature may be generated on save)');
        console.log('[DIAG]   - this.mod.publicKey =', JSON.stringify(this.mod.publicKey));

        // Save new draft transaction (field1 is auto-populated from tx.msg.module)
        await this.app.storage.saveTransaction(tx, {
          field4: field4Value
        }, 'localhost');

        // ========================================================================
        // DIAGNOSTIC: Confirmation that storage.saveTransaction() resolved
        // ========================================================================
        console.log('[DIAG] saveDraftTransaction() storage.saveTransaction() RESOLVED (new draft created)');
        console.log('[DIAG] saveDraftTransaction() After save, tx.signature =', tx.signature || 'N/A (still unsigned?)');
        
        // ========================================================================
        // DIAGNOSTIC: Immediately verify what was stored by querying back
        // ========================================================================
        // Try verification with signature first (if available)
        if (tx.signature) {
          console.log('[DIAG] saveDraftTransaction() Verifying saved draft by signature...');
          this.app.storage.loadTransactions(
            { field1: 'Stack', field4: 'stack:draft', signature: tx.signature },
            (verificationTxs) => {
              const verifyCount = verificationTxs ? verificationTxs.length : 0;
              console.log('[DIAG] saveDraftTransaction() Verification query (by signature) found', verifyCount, 'matching transactions');
              if (verifyCount > 0 && verificationTxs[0]) {
                const verifyTx = verificationTxs[0];
                console.log('[DIAG] saveDraftTransaction() Verified transaction has:');
                console.log('[DIAG]   - field1:', JSON.stringify(verifyTx.field1 || 'N/A'));
                console.log('[DIAG]   - field2:', JSON.stringify(verifyTx.field2 || 'N/A'));
                console.log('[DIAG]   - field4:', JSON.stringify(verifyTx.field4 || 'N/A'));
                console.log('[DIAG]   - signature:', verifyTx.signature || 'N/A');
              } else {
                console.log('[DIAG] saveDraftTransaction() WARNING: Verification query (by signature) found NO matching transactions!');
              }
            },
            'localhost'
          );
        } else {
          console.log('[DIAG] saveDraftTransaction() Transaction has no signature after save (unsigned transaction)');
        }
        
        // ========================================================================
        // DIAGNOSTIC: Also verify by field1 + field4 (same query as discoverDrafts)
        // ========================================================================
        console.log('[DIAG] saveDraftTransaction() Verifying saved draft using discoverDrafts() query pattern...');
        this.app.storage.loadTransactions(
          { field1: 'Stack', field4: 'stack:draft' },
          (verificationTxs) => {
            const verifyCount = verificationTxs ? verificationTxs.length : 0;
            console.log('[DIAG] saveDraftTransaction() Verification query (field1+field4) found', verifyCount, 'matching transactions');
            if (verifyCount > 0) {
              console.log('[DIAG] saveDraftTransaction() All matching drafts:');
              verificationTxs.forEach((verifyTx, idx) => {
                console.log(`[DIAG]   Draft ${idx + 1}:`);
                console.log(`[DIAG]     - field1: ${JSON.stringify(verifyTx.field1 || 'N/A')}`);
                console.log(`[DIAG]     - field2: ${JSON.stringify(verifyTx.field2 || 'N/A')}`);
                console.log(`[DIAG]     - field4: ${JSON.stringify(verifyTx.field4 || 'N/A')}`);
                console.log(`[DIAG]     - signature: ${verifyTx.signature || 'N/A'}`);
              });
            } else {
              console.log('[DIAG] saveDraftTransaction() CRITICAL: Verification query (field1+field4) found NO matching transactions!');
              console.log('[DIAG] saveDraftTransaction() This means the draft was NOT saved or was saved with different field values.');
            }
          },
          'localhost'
        );

        // Log successful save (downgraded from diagnostic)
        console.debug('Stack: storage.saveTransaction() resolved (new draft created)');

        // Store reference for future updates and set active draft ID
        this.draftTransaction = tx;
        this.activeDraftId = tx.signature || tx.hash || null;
        
        // ========================================================================
        // [EDITOR-INVARIANT] Log new draft creation for validation
        // ========================================================================
        console.debug('[EDITOR-INVARIANT] New draft created and bound:', this.activeDraftId);
      } else {
        console.log('[DIAG] saveDraftTransaction() Updating EXISTING draft transaction (signature:', tx.signature || tx.hash, ')');
        // Update existing draft transaction
        const data = {
          type: 'stack_post',
          title: title.trim() || '',
          content: content.trim() || '',
          tags: [],
          image: this.featuredImage || '', // Featured/teaser image (singular, separate)
          imageUrl: '',
          timestamp: tx.msg?.data?.timestamp || Date.now(),
          subscriptionTier: 'free',
          excerpt: ''
        };

        tx.msg = {
          module: 'Stack',
          request: 'create stack post request',
          data: data
        };

        // ========================================================================
        // DIAGNOSTIC: Log field4 value being saved
        // ========================================================================
        const field4Value = 'stack:draft';
        console.log('[DIAG] saveDraftTransaction() Updating draft with field4 =', field4Value);

        // ========================================================================
        // DIAGNOSTIC: Log exact values being updated (field1, field2, field4, peer)
        // ========================================================================
        console.log('[DIAG] saveDraftTransaction() About to update with:');
        console.log('[DIAG]   - field1: (should remain from original transaction, expected: "Stack")');
        console.log('[DIAG]   - field2: (should remain from original transaction, expected: publicKey)');
        console.log('[DIAG]   - field4:', field4Value);
        console.log('[DIAG]   - peer: "localhost"');
        console.log('[DIAG]   - tx.signature =', tx.signature || 'N/A');
        console.log('[DIAG]   - tx.msg.module =', tx.msg?.module);

        // Update existing draft transaction (field1 is auto-populated from tx.msg.module)
        await this.app.storage.updateTransaction(tx, {
          field4: field4Value
        }, 'localhost');

        // ========================================================================
        // DIAGNOSTIC: Confirmation that storage.updateTransaction() resolved
        // ========================================================================
        console.log('[DIAG] saveDraftTransaction() storage.updateTransaction() RESOLVED (draft updated)');
        
        // ========================================================================
        // DIAGNOSTIC: Immediately verify what was stored by querying back
        // ========================================================================
        if (tx.signature) {
          console.log('[DIAG] saveDraftTransaction() Verifying updated draft by querying storage...');
          this.app.storage.loadTransactions(
            { field1: 'Stack', field4: 'stack:draft', signature: tx.signature },
            (verificationTxs) => {
              const verifyCount = verificationTxs ? verificationTxs.length : 0;
              console.log('[DIAG] saveDraftTransaction() Verification query found', verifyCount, 'matching transactions');
              if (verifyCount > 0 && verificationTxs[0]) {
                const verifyTx = verificationTxs[0];
                console.log('[DIAG] saveDraftTransaction() Verified transaction has:');
                console.log('[DIAG]   - field1:', verifyTx.field1 || 'N/A');
                console.log('[DIAG]   - field2:', verifyTx.field2 || 'N/A');
                console.log('[DIAG]   - field4:', verifyTx.field4 || 'N/A');
                console.log('[DIAG]   - signature:', verifyTx.signature || 'N/A');
              } else {
                console.log('[DIAG] saveDraftTransaction() WARNING: Verification query found NO matching transactions!');
              }
            },
            'localhost'
          );
        }

        // Log successful update (downgraded from diagnostic)
        console.debug('Stack: storage.updateTransaction() resolved (draft updated)');
      }
      
      // ========================================================================
      // DIAGNOSTIC: Check whether refreshDrafts() is called afterward
      // ========================================================================
      console.log('[DIAG] saveDraftTransaction() EXIT: refreshDrafts() is NOT called (draft discovery happens on next editor entry)');
    } catch (error) {
      console.error('[DIAG] saveDraftTransaction() ERROR:', error);
      console.error('Stack: Error saving draft transaction:', error);
      // Re-throw to allow caller to handle error (triggerSave catches it)
      throw error;
    }
  }

  /**
   * Update save state indicator
   */
  updateSaveState(state) {
    this.saveState = state;
    this.updateStatusDisplay();
  }

  /**
   * Update status display in sidebar
   * Shows "Saving…" (italic) when saving, otherwise shows "Draft" or "Published" based on isPublished
   * 
   * Status UI rules:
   * - "Status:" label is always visible
   * - When saving: "Saving…" in italic, visible for minimum 500ms (enforced in triggerSave)
   * - After save: "Draft" again
   */
  updateStatusDisplay() {
    const statusValueElement = document.querySelector('#stack-editor-status-value');
    if (!statusValueElement) return;

    let statusText;
    if (this.saveState === 'saving') {
      statusText = 'Saving…';
      statusValueElement.classList.add('saving'); // CSS should style this as italic
    } else {
      statusText = this.isPublished ? 'Published' : 'Draft';
      statusValueElement.classList.remove('saving');
    }

    statusValueElement.textContent = statusText;
  }

  /**
   * Check if document has content and update next step button
   */
  updateNextStepButton() {
    const nextStepBtn = document.querySelector('#stack-next-step-btn');
    if (!nextStepBtn) return;

    const title = document.querySelector('#stack-post-title-input')?.value || '';
    const editor = document.querySelector('#stack-post-body-editor');
    let hasContent = false;
    if (editor) {
      const blockElements = editor.querySelectorAll('[data-block-id]');
      for (const blockEl of blockElements) {
        const blockType = blockEl.getAttribute('data-block-type');
        if (blockType === 'paragraph' || blockType === 'heading' || blockType === 'list-item' || blockType === 'blockquote') {
          const text = (blockEl.textContent || '').replace(/\u200B/g, '').trim();
          if (text.length > 0) {
            hasContent = true;
            break;
          }
        } else if (blockType === 'image') {
          hasContent = true;
          break;
        } else if (blockType === 'rawhtml') {
          const html = (blockEl.innerHTML || '').trim();
          if (html.length > 0) {
            hasContent = true;
            break;
          }
        }
      }
    }

    const hasTitle = title.trim().length > 0;

    if (hasContent || hasTitle) {
      nextStepBtn.disabled = false;
    } else {
      nextStepBtn.disabled = true;
    }
  }


  /**
   * Get the currently focused block element
   * B1: Block identity is a type system - ONLY editable leaf nodes may have data-block-id
   * Returns only elements with data-block-id (blocks), never structural containers like <ul>
   */
  getFocusedBlock() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;

    let node = selection.anchorNode;
    while (node && node !== document) {
      if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('data-block-id')) {
        // Code blocks require special handling: <pre> elements with data-block-id must be
        // treated as blocks even when selection is inside nested <code> or other elements
        // The browser may create nested structure (e.g., <pre><code>text</code></pre>),
        // but we must always resolve to the <pre> element that has data-block-id
        if (node.tagName === 'PRE' && node.getAttribute('data-block-type') === 'code') {
          return node;
        }
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  /**
   * Get block count from DOM (replaces this.document.blocks.length)
   * B1: Block identity - counts ONLY elements with data-block-id (true blocks)
   * Structural containers like <ul> are never counted
   */
  getBlockCount() {
    const editor = document.querySelector('#stack-post-body-editor');
    if (!editor) return 0;
    return editor.querySelectorAll('[data-block-id]').length;
  }

  /**
   * A2: data-block-index removed - order is derived from DOM position only
   * B4: Adjacency logic must be DOM-safe - never rely on cached indices
   */

  /**
   * Get text offset from selection within a block
   */
  /**
   * Get text offset from selection within a block.
   * 
   * STRUCTURAL CONSTRAINT: This function is ONLY for paragraph splitting.
   * Using it elsewhere (normalization, heading/list/blockquote Enter) is a structural violation.
   * 
   * Cursor offset logic exists ONLY in paragraph Enter completion.
   * All other Enter paths (heading, list, blockquote) must NOT use cursor offsets.
   */
  getTextOffsetInBlock(blockElement, selection) {
    const range = selection.getRangeAt(0);
    return this.getTextOffsetFromRange(blockElement, range);
  }

  /**
   * Get text offset from a range within a block
   */
  getTextOffsetFromRange(blockElement, range) {
    let offset = 0;
    
    // Walk through text nodes in the block
    const walker = document.createTreeWalker(
      blockElement,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let textNode = walker.nextNode();
    while (textNode) {
      if (textNode === range.startContainer) {
        offset += range.startOffset;
        break;
      }
      // Remove zero-width space from length calculation
      const textLength = textNode.textContent.replace(/\u200B/g, '').length;
      offset += textLength;
      textNode = walker.nextNode();
    }
    
    return offset;
  }

  /**
   * Handle Enter key - split paragraph block
   * If text is selected, delete selection and insert newline
   * If in a block-formatted line and line is empty, exit the block
   * 
   * DOM-AUTHORITATIVE INVARIANT:
   * - This function operates ONLY on DOM elements (focusedBlock, DOM nodes)
   * - NO document/block object model exists or should be referenced
   * - The ONLY allowed state variables are:
   *   * focusedBlock (DOM Element node)
   *   * blockType (string from DOM attribute or tagName)
   *   * selection / range (Selection API objects)
   * - Variables like `block`, `block.text`, `block.type` must NEVER be introduced
   * - All block information must come from DOM inspection (attributes, textContent, tagName)
   */
  handleEnterKey(e) {
    // ========================================================================
    // EDITOR CORE INFRASTRUCTURE
    // ========================================================================
    // This function is editor core infrastructure.
    // Changes must preserve all stated invariants.
    // Do not add recovery logic, heuristics, or alternative code paths.
    // 
    // This function implements a deterministic Enter key handling system with
    // strict phase separation: Intent Capture → Normalization → Enter Completion.
    // All invariants, illegal states, and structural rules documented within
    // this function must be preserved. Violations are bugs, not edge cases.
    // ========================================================================
    
    // ========================================================================
    // ATOMIC EVENT CLAIMING
    // ========================================================================
    // Enter is claimed atomically at the top of the handler to prevent race conditions.
    // Once handleEnterKey() runs, the browser must NEVER process the Enter key.
    // Normalization and completion run under full event control, ensuring deterministic behavior.
    // 
    // INVARIANT: Enter prevention is centralized here and must not be reintroduced conditionally.
    // No branch in this function "decides" whether Enter is prevented - it is always prevented.
    e.preventDefault();

    // ========================================================================
    // PHASE 1: INTENT CAPTURE
    // ========================================================================
    // Capture current editor state and user intent before any mutations.
    // This phase is read-only and establishes the context for all subsequent phases.
    
    // DOM-AUTHORITATIVE: Get focused block element (DOM node only)
    let focusedBlock = this.getFocusedBlock();
    if (!focusedBlock) {
      throw new Error('Enter pressed in invalid editor state: no focused block (cursor outside block element)');
    }

    // Postcondition enforcement: track structural mutations
    let didMutateStructure = false;
    
    // Option 2: Store trailing text from code block normalization for completion phase
    let codeBlockTrailingText = null;

    // ========================================================================
    // BLOCK TYPE INFERENCE RULES (NON-NEGOTIABLE)
    // ========================================================================
    // Block type is defined EXCLUSIVELY by the 'data-block-type' DOM attribute.
    // Valid values: 'paragraph', 'heading', 'list-item', 'blockquote', 'image', 'rawhtml'
    // 
    // INVARIANT: Block type must NEVER be inferred from:
    //   - Cursor position or offsets
    //   - Text content patterns (markdown markers, etc.)
    //   - Heuristic analysis
    //   - Tag names alone (e.g., <h1>, <li>, <p>)
    //   - CSS classes or other attributes
    // 
    // The 'data-block-type' attribute is the SINGLE SOURCE OF TRUTH for block type.
    // All Enter behavior reasoning must reference this attribute only.
    // DOM-AUTHORITATIVE: Get block type from DOM attribute (string only)
    let blockType = focusedBlock.getAttribute('data-block-type');

    // INVARIANT: blockType must be non-null during Enter handling.
    // If data-block-type is missing, infer ONCE from tagName and set the attribute.
    // This is a one-time fix for blocks that lack the attribute; after this, blockType is authoritative.
    if (blockType === null) {
      const tagName = focusedBlock.tagName.toLowerCase();
      if (tagName === 'p') {
        blockType = 'paragraph';
      } else if (tagName.match(/^h[1-6]$/)) {
        blockType = 'heading';
      } else if (tagName === 'li') {
        blockType = 'list-item';
      } else if (tagName === 'blockquote') {
        blockType = 'blockquote';
      } else if (tagName === 'figure' || tagName === 'img') {
        blockType = 'image';
      } else {
        blockType = 'paragraph'; // Default fallback
      }
      focusedBlock.setAttribute('data-block-type', blockType);
    }

    // CRITICAL INVARIANT: Cursor offset is captured ONCE before any DOM mutations.
    // This offset is VALID ONLY for paragraph-to-paragraph splitting (no normalization).
    // If blockType changes during normalization, this offset becomes INVALID and must be discarded.
    // Normalization ignores cursor position and uses the entire line.
    const selection = window.getSelection();
    if (!selection.rangeCount) {
      throw new Error('Enter pressed in invalid editor state: no selection (selection lost after DOM mutation)');
    }
    const originalCursorOffset = this.getTextOffsetInBlock(focusedBlock, selection);
    const originalBlockText = (focusedBlock.textContent || '').replace(/\u200B/g, '');
    const originalBlockType = blockType; // Track original block type to detect normalization
    
    // This offset is used ONLY in paragraph-to-paragraph splitting (Enter completion for paragraphs).
    // If blockType changed during normalization, originalCursorOffset is INVALID and must not be used.
    // Normalization does NOT use cursor offsets - it is purely structural.

    // ========================================================================
    // PHASE 2: BLOCK NORMALIZATION
    // ========================================================================
    // B2: Normalization vs Completion separation
    // Normalization: Detects intent only. MUST NOT read Selection/Range, place cursor, or decide grouping.
    // Convert block types (paragraph → heading, paragraph → list) based on
    // markdown markers. This phase normalizes structure but does NOT create
    // sibling blocks. Normalization updates focusedBlock and blockType in place.
    // 
    // INVARIANT: Normalization never creates siblings, never returns early.
    // INVARIANT: Enter completion always runs after normalization.
    // INVARIANT: Normalization must not move the cursor. Cursor placement occurs
    //            during Enter completion.
    // INVARIANT: Normalization is purely structural - cursor position is irrelevant.
    //            Normalization removes markdown markers and uses the ENTIRE remaining
    //            line. Cursor offset logic exists ONLY in paragraph splitting.
    // 
    // ILLEGAL: Cursor placement in normalization phase
    // - Normalization MUST NEVER place or move the cursor
    // - If cursor is placed here, this is a structural violation
    // - console.warn: "Cursor placement in normalization phase - structural violation"
    // 
    // ILLEGAL: Cursor offset usage in normalization phase
    // - Normalization MUST NEVER reference cursor offsets or Selection
    // - If offsets are used here, this is a structural violation
    // - console.warn: "Cursor offset usage in normalization phase - structural violation"

    // Check for markdown heading conversion: "# ", "## ", "### " at start of paragraph
    // Normalization is PURELY STRUCTURAL - no Selection/Range reading allowed
    // PRECONDITION: Block's visible content (after removing ZWSP) must START WITH the trigger
    if (blockType === 'paragraph') {
      const blockText = (focusedBlock.textContent || '').replace(/\u200B/g, '');
      const trimmedText = blockText.trimStart();
      
      let headingLevel = null;
      if (trimmedText.startsWith('### ')) {
        headingLevel = 3;
      } else if (trimmedText.startsWith('## ')) {
        headingLevel = 2;
      } else if (trimmedText.startsWith('# ')) {
        headingLevel = 1;
      }
      
      if (headingLevel) {
        const leadingWhitespace = blockText.length - trimmedText.length;
        const markerEndOffset = leadingWhitespace + headingLevel + 1;
        const headingText = blockText.substring(markerEndOffset);
        
        const newHeading = document.createElement(`h${headingLevel}`);
        Array.from(focusedBlock.attributes).forEach(attr => {
          if (attr.name !== 'data-block-type') {
            newHeading.setAttribute(attr.name, attr.value);
          }
        });
        newHeading.setAttribute('data-block-type', 'heading');
        newHeading.contentEditable = 'true';
        newHeading.textContent = headingText;
        
        focusedBlock.parentNode.replaceChild(newHeading, focusedBlock);
        focusedBlock = newHeading;
        blockType = 'heading';
      }

      // Check for markdown list creation: "* " or "- " at start of paragraph
      // Normalization is PURELY STRUCTURAL - no Selection/Range reading allowed
      // PRECONDITION: Block's visible content (after removing ZWSP) must START WITH the trigger
      // Note: List normalization was previously restricted to trigger-only blocks (like headers were),
      // but now allows text after the trigger to match header normalization behavior.
      const listBlockText = (focusedBlock.textContent || '').replace(/\u200B/g, '');
      const listTrimmedText = listBlockText.trimStart();
      
      if (listTrimmedText.startsWith('* ') || listTrimmedText.startsWith('- ')) {
        // Invariant 7: Normalization ONLY detects list intent, does NOT create structure.
        // Convert paragraph to <li> only. <ul> creation and grouping happen in Enter completion.
        const listLeadingWhitespace = listBlockText.length - listTrimmedText.length;
        const listMarkerEndOffset = listLeadingWhitespace + 2;
        const itemText = listBlockText.substring(listMarkerEndOffset);
        
        // A1: Persist marker explicitly - C2: No clever inference
        const marker = listTrimmedText.startsWith('* ') ? '* ' : '- ';
        
        // Convert paragraph to <li> (this is converting current block, not creating siblings)
        const liElement = document.createElement('li');
        const liId = generateBlockId(this.getBlockCount());
        liElement.setAttribute('data-block-id', liId);
        liElement.setAttribute('data-block-type', 'list-item');
        liElement.setAttribute('data-list-marker', marker);
        liElement.contentEditable = 'true';
        liElement.textContent = itemText;
        
        // Replace paragraph with <li> (no <ul> wrapper yet)
        focusedBlock.parentNode.replaceChild(liElement, focusedBlock);
        
        // Update focusedBlock and blockType for Enter completion
        focusedBlock = liElement;
        blockType = 'list-item';
      }

      // Check for markdown blockquote creation: "> " at start of paragraph
      // Normalization is PURELY STRUCTURAL - no Selection/Range reading allowed
      // PRECONDITION: Block's visible content (after removing ZWSP) must START WITH the trigger
      const blockquoteBlockText = (focusedBlock.textContent || '').replace(/\u200B/g, '');
      const blockquoteTrimmedText = blockquoteBlockText.trimStart();
      
      if (blockquoteTrimmedText.startsWith('> ')) {
        // Normalization ONLY detects blockquote intent, does NOT create siblings
        const blockquoteLeadingWhitespace = blockquoteBlockText.length - blockquoteTrimmedText.length;
        const blockquoteMarkerEndOffset = blockquoteLeadingWhitespace + 2;
        const blockquoteText = blockquoteBlockText.substring(blockquoteMarkerEndOffset);
        
        // Convert paragraph to blockquote (this is converting current block, not creating siblings)
        const blockquoteElement = document.createElement('blockquote');
        const blockquoteId = generateBlockId(this.getBlockCount());
        blockquoteElement.setAttribute('data-block-id', blockquoteId);
        blockquoteElement.setAttribute('data-block-type', 'blockquote');
        blockquoteElement.contentEditable = 'true';
        blockquoteElement.textContent = blockquoteText;
        
        // Replace paragraph with blockquote
        focusedBlock.parentNode.replaceChild(blockquoteElement, focusedBlock);
        
        // Update focusedBlock and blockType for Enter completion
        focusedBlock = blockquoteElement;
        blockType = 'blockquote';
      }

      // Check for markdown code block creation: "```" at line start (Option 2: supports trailing text)
      // Normalization is PURELY STRUCTURAL - no Selection/Range reading allowed
      // PRECONDITION: After trimming leading whitespace, text must begin with exactly "```"
      // The backticks must be the first non-whitespace characters (line start intent)
      // Normalization is intentionally strict to prevent over-triggering in paste/mid-line scenarios
      const codeBlockText = (focusedBlock.textContent || '').replace(/\u200B/g, '');
      const trimmedStart = codeBlockText.trimStart();
      
      if (trimmedStart.startsWith('```')) {
        // Verify trailing text (if any) is on the same line (no newlines between backticks and text)
        const afterBackticks = trimmedStart.substring(3);
        const hasNewlineInTrailing = afterBackticks.includes('\n');
        
        // Only normalize if backticks are at line start and trailing text (if any) is on same line
        if (!hasNewlineInTrailing) {
          // Option 2: Capture trailing text after the three backticks for completion phase
          // The opening backticks are removed; trailing text (if any) is stored for insertion
          const trailingText = afterBackticks.trim() || null;
          codeBlockTrailingText = trailingText; // Store null if empty, not empty string
          
          // Normalization ONLY detects code block intent, does NOT create siblings
          // Convert paragraph to code block (this is converting current block, not creating siblings)
          const codeElement = document.createElement('pre');
          const codeId = generateBlockId(this.getBlockCount());
          codeElement.setAttribute('data-block-id', codeId);
          codeElement.setAttribute('data-block-type', 'code');
          codeElement.contentEditable = 'true';
          codeElement.textContent = ''; // Start with empty code block (canonical structure)
          
          // Replace paragraph with code block
          focusedBlock.parentNode.replaceChild(codeElement, focusedBlock);
          
          // Update focusedBlock and blockType for Enter completion
          focusedBlock = codeElement;
          blockType = 'code';
        }
      }
    }

    // ========================================================================
    // PHASE 3: ENTER COMPLETION
    // ========================================================================
    // Create the next block (sibling) based on current block type and state.
    // This phase always runs after normalization (if any occurred).
    // 
    // STRUCTURAL SEPARATION:
    // - Paragraph Enter splits text and requires cursor offset logic
    // - Heading/List/Blockquote Enter exits the block and does NOT split text
    // 
    // INVARIANT: Every Enter keypress results in exactly one structural change.
    // INVARIANT: Enter completion always creates sibling blocks.
    // INVARIANT: Enter completion is the sole authority for cursor placement.
    // NOTE: Early returns ARE allowed in this phase (after completion is done),
    //       but NOT in normalization phase (which must always proceed to completion).
    // 
    // ========================================================================
    // ILLEGAL STATES (STRUCTURAL VIOLATIONS, NOT EDGE CASES)
    // ========================================================================
    // The following states MUST NEVER occur. If they do, they are bugs, not
    // situations to "handle" with recovery logic:
    // 
    // 1. Enter completion without creating a new block
    //    - Every Enter completion MUST create exactly one new block
    //    - If no block is created, this is a structural violation
    //    - console.warn: "Enter completion failed to create new block - structural violation"
    // 
    // 2. Cursor placement outside Enter completion
    //    - Cursor placement MUST ONLY occur in Enter completion phase
    //    - Normalization, event handlers, or other code MUST NOT place cursor
    //    - If cursor is placed elsewhere, this is a structural violation
    //    - console.warn: "Cursor placed outside Enter completion - structural violation"
    // 
    // 3. Blocks without a text node after Enter
    //    - Every block created by Enter completion MUST have a text node
    //    - textContent='' creates a text node, which is sufficient
    //    - If a block lacks a text node, this is a structural violation
    //    - console.warn: "Block created without text node - structural violation"
    // 
    // 4. Selection recovery during Enter handling
    //    - Enter handling MUST NOT attempt to "recover" from stale selection
    //    - Selection is captured once in Phase 1, then cursor is placed deterministically
    //    - If selection is recomputed or "recovered", this is a structural violation
    //    - console.warn: "Selection recovery attempted during Enter - structural violation"

    // ========================================================================
    // LIST ITEM ENTER: Exit list (no text splitting)
    // ========================================================================
    // Heading/List/Blockquote Enter exits the block and does NOT split text.
    // List item Enter exits the list and creates a paragraph below.
    // NO cursor offset logic - this is unconditional block exit.
    // 
    // ILLEGAL: Offset logic is illegal here. Cursor offset logic exists ONLY in paragraph splitting.
    // Using getTextOffsetInBlock() or originalCursorOffset here is a structural violation.
    // 
    // L1: Only <li> elements are blocks. Enter completion for list items.
    // Invariant 8: Enter completion is the ONLY place where <ul> is created and <li> is appended.
    if (blockType === 'list-item' && focusedBlock.tagName === 'LI') {
      // Invariant 8: Ensure <li> is wrapped in <ul> (may not be if just normalized)
      let ulElement = focusedBlock.parentNode;
      if (ulElement.tagName !== 'UL') {
        // <li> is not in <ul> yet - create <ul> and wrap it
        // B4: Adjacency logic must be DOM-safe - skip non-element nodes, never scan more than one block
        const editor = ulElement;
        let prevBlock = focusedBlock.previousSibling;
        while (prevBlock && prevBlock.nodeType === Node.ELEMENT_NODE && !prevBlock.hasAttribute('data-block-id')) {
          prevBlock = prevBlock.previousSibling;
        }
        
        if (prevBlock && prevBlock.tagName === 'LI' && prevBlock.getAttribute('data-block-type') === 'list-item') {
          // B4: Adjacency-based grouping - immediately previous block is <li>
          ulElement = prevBlock.parentNode;
          ulElement.appendChild(focusedBlock);
        } else {
          // B1: Create new <ul> (no data-block-id or data-block-type) - structural container only
          ulElement = document.createElement('ul');
          editor.insertBefore(ulElement, focusedBlock);
          ulElement.appendChild(focusedBlock);
        }
      }
      
      const listItemText = (focusedBlock.textContent || '').replace(/\u200B/g, '').trim();
      const isEmpty = listItemText.length === 0;
      
      if (isEmpty) {
        // L3: Empty list item exits the list - remove empty <li> and create paragraph below
        const ulElement = focusedBlock.parentNode;
        const editor = ulElement.parentNode;
        const ulNextSibling = ulElement.nextSibling;
        const willRemoveUl = ulElement.children.length === 1;
        
        // Remove the empty <li>
        ulElement.removeChild(focusedBlock);
        
        // If <ul> is now empty, remove it
        if (willRemoveUl) {
          ulElement.parentNode.removeChild(ulElement);
        }
        
        // Create new paragraph below
        const newBlockElement = document.createElement('p');
        const newBlockId = generateBlockId(this.getBlockCount());
        newBlockElement.setAttribute('data-block-id', newBlockId);
        newBlockElement.setAttribute('data-block-type', 'paragraph');
        newBlockElement.contentEditable = 'true';
        const caretAnchor = document.createTextNode('\u200B');
        newBlockElement.appendChild(caretAnchor);
        
        // Insert after the list (or where list was if removed)
        if (willRemoveUl) {
          // <ul> was removed - insert where it was
          if (ulNextSibling) {
            editor.insertBefore(newBlockElement, ulNextSibling);
        } else {
            editor.appendChild(newBlockElement);
          }
        } else {
          // <ul> still exists - insert after it
          if (ulElement.nextSibling) {
            editor.insertBefore(newBlockElement, ulElement.nextSibling);
          } else {
            editor.appendChild(newBlockElement);
          }
        }
        
        this.updatePlaceholderVisibility();
        
        const newRange = document.createRange();
        const newSelection = window.getSelection();
        newRange.setStart(caretAnchor, 0);
        newRange.setEnd(caretAnchor, 0);
        newSelection.removeAllRanges();
        newSelection.addRange(newRange);
        newBlockElement.focus();
        this.autoScrollToCaret();
        didMutateStructure = true;
      return;
      } else {
        // L4: Non-empty list item continues the list - create new <li> with same marker
        const ulElement = focusedBlock.parentNode;
        const editor = ulElement.parentNode;
        
        // A1: Read marker from stored data, NOT from textContent - C2: No clever inference
        const marker = focusedBlock.getAttribute('data-list-marker') || '- ';
        
        // Create new <li> element
        const newLiElement = document.createElement('li');
        const newLiId = generateBlockId(this.getBlockCount());
        newLiElement.setAttribute('data-block-id', newLiId);
        newLiElement.setAttribute('data-block-type', 'list-item');
        newLiElement.setAttribute('data-list-marker', marker);
        newLiElement.contentEditable = 'true';
        
        // I2: <li>.textContent MUST NEVER include the marker - marker is in data-list-marker only
        // I3: Visual markers rendered via CSS, not textContent
        const caretAnchor = document.createTextNode('\u200B');
        newLiElement.appendChild(caretAnchor);
        
        // Append to existing <ul>
        ulElement.appendChild(newLiElement);
        
        this.updatePlaceholderVisibility();
        
        const newRange = document.createRange();
        const newSelection = window.getSelection();
        newRange.setStart(caretAnchor, 0);
        newRange.setEnd(caretAnchor, 0);
        newSelection.removeAllRanges();
        newSelection.addRange(newRange);
        newLiElement.focus();
        this.autoScrollToCaret();
        didMutateStructure = true;
        return;
      }
    }

    // ========================================================================
    // EMPTY BLOCKQUOTE EXIT: Remove blockquote and create paragraph in its place
    // ========================================================================
    // Enter on empty blockquote: Remove the blockquote, create paragraph in its place.
    // NO cursor offset logic - this is unconditional block replacement.
    // 
    // ILLEGAL: Offset logic is illegal here. Cursor offset logic exists ONLY in paragraph splitting.
    const blockText = (focusedBlock.textContent || '').replace(/\u200B/g, '').trim();
    const isEmpty = blockText.length === 0;

    if (blockType === 'blockquote' && isEmpty) {
      // Remove blockquote and create paragraph in its place
      // e.preventDefault() already called at function start
      // NO cursor offset logic - this is unconditional block replacement
      // ILLEGAL: Offset logic is illegal here
      
      const editor = focusedBlock.parentNode;
      const newBlockElement = document.createElement('p');
      const newBlockId = generateBlockId(this.getBlockCount());
      newBlockElement.setAttribute('data-block-id', newBlockId);
      newBlockElement.setAttribute('data-block-type', 'paragraph');
      newBlockElement.contentEditable = 'true';
      // ILLEGAL: Blocks MUST have a text node. ENTER completion must ensure new blocks contain a caret anchor.
      const caretAnchor = document.createTextNode('\u200B');
      newBlockElement.appendChild(caretAnchor);
      
      // Replace blockquote with paragraph
      editor.replaceChild(newBlockElement, focusedBlock);
      
      this.updatePlaceholderVisibility();
      
      // Enter completion is the sole authority for cursor placement.
      const newRange = document.createRange();
      const newSelection = window.getSelection();
      newRange.setStart(caretAnchor, 0);
      newRange.setEnd(caretAnchor, 0);
      newSelection.removeAllRanges();
      newSelection.addRange(newRange);
      newBlockElement.focus();
      this.autoScrollToCaret();
      didMutateStructure = true;
      return;
    }

    // ========================================================================
    // EMPTY BLOCK EXIT: Exit block when empty (no text splitting)
    // ========================================================================
    // Heading/List Enter exits the block and does NOT split text.
    // When the block is empty, convert it to paragraph and create new paragraph below.
    // NO cursor offset logic - this is unconditional block exit.
    // 
    // ILLEGAL: Offset logic is illegal here. Cursor offset logic exists ONLY in paragraph splitting.
    // Using getTextOffsetInBlock() or originalCursorOffset here is a structural violation.
    const isBlockFormatted = blockType === 'list-item' || blockType === 'heading';
    const isEmptyFormatted = blockText.length === 0;

    if (isBlockFormatted && isEmptyFormatted) {
      // EXIT BLOCK: Remove formatting and create normal paragraph
      // e.preventDefault() already called at function start
      // NO cursor offset logic - this is unconditional block exit
      // ILLEGAL: Offset logic is illegal here

      // Convert current block to paragraph IN PLACE
      focusedBlock.setAttribute('data-block-type', 'paragraph');
      focusedBlock.classList.remove('stack-list-item', 'stack-blockquote');
      focusedBlock.textContent = '';
      const emptyTextNode = document.createTextNode('\u200B');
      focusedBlock.appendChild(emptyTextNode);

      // Create new paragraph block in DOM
      // ILLEGAL: Enter completion MUST create a new block. If no block is created here, this is a bug.
      const editor = focusedBlock.parentNode;
      const newBlockElement = document.createElement('p');
      const newBlockId = generateBlockId(this.getBlockCount());
      newBlockElement.setAttribute('data-block-id', newBlockId);
      newBlockElement.setAttribute('data-block-type', 'paragraph');
      newBlockElement.contentEditable = 'true';
      // ILLEGAL: Blocks MUST have a text node. ENTER completion must ensure new blocks contain a caret anchor.
      // Empty block: ensure caret anchor exists for stable cursor placement
      const caretAnchor = document.createTextNode('\u200B');
      newBlockElement.appendChild(caretAnchor);
      
      // Insert after current block
      if (focusedBlock.nextSibling) {
        editor.insertBefore(newBlockElement, focusedBlock.nextSibling);
      } else {
        editor.appendChild(newBlockElement);
      }

    // Update placeholder visibility
    this.updatePlaceholderVisibility();

      // Enter completion is the sole authority for cursor placement.
      // ILLEGAL: Cursor placement MUST ONLY occur in Enter completion. If placed elsewhere, this is a bug.
      // Cursor placement is deterministic: always at offset 0 of the text node.
      // ENTER completion ensures the editor is in a stable state with exactly one active block
      // and a valid collapsed selection inside that block.
      // ILLEGAL: Selection recovery is forbidden. Selection is captured once, cursor is placed deterministically.
      const newRange = document.createRange();
      const newSelection = window.getSelection();
      newRange.setStart(caretAnchor, 0);
      newRange.setEnd(caretAnchor, 0);
      newSelection.removeAllRanges();
      newSelection.addRange(newRange);
      newBlockElement.focus();
      this.autoScrollToCaret();
      didMutateStructure = true;
      return;
    }

    // ========================================================================
    // CODE BLOCK ENTER: Insert newline or exit block
    // ========================================================================
    // Enter inside code block either inserts a newline (didMutateStructure = false allowed)
    // or exits the block if user types "```" on an empty line.
    // Code blocks use cursor position to detect exit trigger, but do NOT split text.
    if (blockType === 'code') {
      // Option 2: If code block was just normalized with trailing text, insert it as first line
      if (codeBlockTrailingText !== null) {
        // Insert trailing text as the first line inside the code block
        // Canonical structure: code block content always begins on its own line
        const textNode = document.createTextNode(codeBlockTrailingText);
        focusedBlock.appendChild(textNode);
        
        // Place cursor immediately after the inserted text
        const newRange = document.createRange();
        const newSelection = window.getSelection();
        newRange.setStart(textNode, textNode.textContent.length);
        newRange.setEnd(textNode, textNode.textContent.length);
        newSelection.removeAllRanges();
        newSelection.addRange(newRange);
        focusedBlock.focus();
        this.autoScrollToCaret();
        
        // Clear the trailing text (one-time insertion)
        codeBlockTrailingText = null;
        didMutateStructure = true;
        return;
      }
      // Check if current line is exactly "```" - if so, exit code block
      const codeText = (focusedBlock.textContent || '').replace(/\u200B/g, '');
      const currentSelection = window.getSelection();
      if (currentSelection.rangeCount > 0) {
        const range = currentSelection.getRangeAt(0);
        // Calculate cursor offset directly from range (not using getTextOffsetInBlock helper)
        let cursorOffset = 0;
        const walker = document.createTreeWalker(
          focusedBlock,
          NodeFilter.SHOW_TEXT,
          null
        );
        let textNode = walker.nextNode();
        while (textNode) {
          if (textNode === range.startContainer) {
            cursorOffset += range.startOffset;
            break;
          }
          const textLength = textNode.textContent.replace(/\u200B/g, '').length;
          cursorOffset += textLength;
          textNode = walker.nextNode();
        }
        
        // Find the current line by looking backwards for newline
        let lineStart = 0;
        for (let i = cursorOffset - 1; i >= 0; i--) {
          if (codeText[i] === '\n') {
            lineStart = i + 1;
            break;
          }
        }
        
        // Find the end of the current line
        let lineEnd = codeText.length;
        for (let i = cursorOffset; i < codeText.length; i++) {
          if (codeText[i] === '\n') {
            lineEnd = i;
            break;
          }
        }
        
        // Get current line and check if it's exactly "```"
        const currentLine = codeText.substring(lineStart, lineEnd).trim();
        
        if (currentLine === '```') {
          // Exit code block: create paragraph below
      const editor = focusedBlock.parentNode;
          const newBlockElement = document.createElement('p');
          const newBlockId = generateBlockId(this.getBlockCount());
          newBlockElement.setAttribute('data-block-id', newBlockId);
          newBlockElement.setAttribute('data-block-type', 'paragraph');
          newBlockElement.contentEditable = 'true';
          const caretAnchor = document.createTextNode('\u200B');
          newBlockElement.appendChild(caretAnchor);
          
          // Insert after code block
          if (focusedBlock.nextSibling) {
            editor.insertBefore(newBlockElement, focusedBlock.nextSibling);
      } else {
            editor.appendChild(newBlockElement);
          }
          
          this.updatePlaceholderVisibility();
          
          const newRange = document.createRange();
          const newSelection = window.getSelection();
          newRange.setStart(caretAnchor, 0);
          newRange.setEnd(caretAnchor, 0);
          newSelection.removeAllRanges();
          newSelection.addRange(newRange);
          newBlockElement.focus();
          this.autoScrollToCaret();
          didMutateStructure = true;
          return;
        }
      }
      
      // Not exiting: manually insert newline into code block
      // didMutateStructure = false is explicitly allowed for code block newlines
      // This is the ONLY case where didMutateStructure = false is allowed
      // Since e.preventDefault() was called, we must manually insert the newline
      if (currentSelection.rangeCount > 0) {
        const range = currentSelection.getRangeAt(0);
        const container = range.startContainer;
        if (container.nodeType === Node.TEXT_NODE && container.parentNode === focusedBlock) {
          // Cursor is in a text node directly inside PRE: insert newline directly
          const offset = range.startOffset;
          const text = container.textContent;
          container.textContent = text.substring(0, offset) + '\n' + text.substring(offset);
          // Place cursor after the newline
          const newRange = document.createRange();
          newRange.setStart(container, offset + 1);
          newRange.setEnd(container, offset + 1);
          currentSelection.removeAllRanges();
          currentSelection.addRange(newRange);
        } else {
          // Cursor is in PRE element or not in a direct text node:
          // Calculate text offset and insert newline into text content
          let insertOffset = 0;
          const walker = document.createTreeWalker(
            focusedBlock,
            NodeFilter.SHOW_TEXT,
            null
          );
          let node = walker.nextNode();
          while (node) {
            if (node === range.startContainer) {
              insertOffset += range.startOffset;
              break;
            }
            insertOffset += node.textContent.replace(/\u200B/g, '').length;
            node = walker.nextNode();
          }
          
          // Get all text content and insert newline
          const codeText = (focusedBlock.textContent || '').replace(/\u200B/g, '');
          const newText = codeText.substring(0, insertOffset) + '\n' + codeText.substring(insertOffset);
          
          // Replace all child nodes with a single text node containing the updated text
          while (focusedBlock.firstChild) {
            focusedBlock.removeChild(focusedBlock.firstChild);
          }
          const newTextNode = document.createTextNode(newText);
          focusedBlock.appendChild(newTextNode);
          
          // Place cursor after the inserted newline
          const newRange = document.createRange();
          newRange.setStart(newTextNode, insertOffset + 1);
          newRange.setEnd(newTextNode, insertOffset + 1);
          currentSelection.removeAllRanges();
          currentSelection.addRange(newRange);
        }
      }
      // didMutateStructure remains false - this is the whitelisted exception
      return;
    }

    // ========================================================================
    // HEADING/BLOCKQUOTE ENTER: Exit block (no text splitting)
    // ========================================================================
    // Heading/List/Blockquote Enter exits the block and does NOT split text.
    // This path does NOT use cursor offset logic - it unconditionally exits the block
    // and creates a new paragraph below, leaving the current block unchanged.
    // (List items are handled above with special logic for continuing/exiting lists)
    // (Empty blocks are handled above - they exit the block format)
    // Enter completion is the sole authority for cursor placement.
    // 
    // ILLEGAL: Offset logic is illegal here. Cursor offset logic exists ONLY in paragraph splitting.
    // Using getTextOffsetInBlock() or originalCursorOffset here is a structural violation.
    if (blockType === 'heading' || blockType === 'blockquote') {
      // Exit heading/blockquote: leave current block unchanged, create new paragraph below
      // e.preventDefault() already called at function start
      // NO cursor offset logic - this is unconditional block exit
      // ILLEGAL: Offset logic is illegal here
      
      // Create new paragraph block in DOM
      // (List items are handled earlier and never reach this code path)
      // ILLEGAL: Enter completion MUST create a new block. If no block is created here, this is a bug.
      const editor = focusedBlock.parentNode;
      const newBlockElement = document.createElement('p');
        newBlockElement.setAttribute('data-block-type', 'paragraph');
      
      const newBlockId = generateBlockId(this.getBlockCount());
      newBlockElement.setAttribute('data-block-id', newBlockId);
      newBlockElement.contentEditable = 'true';
      // ILLEGAL: Blocks MUST have a text node. ENTER completion must ensure new blocks contain a caret anchor.
      // Empty block: ensure caret anchor exists for stable cursor placement
      const caretAnchor = document.createTextNode('\u200B');
      newBlockElement.appendChild(caretAnchor);
      
      // Insert after current block
      if (focusedBlock.nextSibling) {
        editor.insertBefore(newBlockElement, focusedBlock.nextSibling);
      } else {
        editor.appendChild(newBlockElement);
      }

    // Update placeholder visibility
    this.updatePlaceholderVisibility();

      // Enter completion is the sole authority for cursor placement.
      // ILLEGAL: Cursor placement MUST ONLY occur in Enter completion. If placed elsewhere, this is a bug.
      // Cursor placement is deterministic: always at offset 0 of the text node.
      // ENTER completion ensures the editor is in a stable state with exactly one active block
      // and a valid collapsed selection inside that block.
      // ILLEGAL: Selection recovery is forbidden. Selection is captured once, cursor is placed deterministically.
      const newRange = document.createRange();
      const newSelection = window.getSelection();
      newRange.setStart(caretAnchor, 0);
      newRange.setEnd(caretAnchor, 0);
      newSelection.removeAllRanges();
      newSelection.addRange(newRange);
      newBlockElement.focus();
      this.autoScrollToCaret();
      didMutateStructure = true;
      return;
    }

    // For other block types (image, rawhtml), Enter is invalid
    // Note: e.preventDefault() was already called at function start, so default behavior is prevented
    // Silent Enter failures are forbidden - invalid states must throw, not return silently
    if (blockType !== 'paragraph') {
      throw new Error(`Enter pressed in invalid editor state: block type '${blockType}' is not editable`);
    }

    // ========================================================================
    // PARAGRAPH ENTER: Split text (requires cursor offset logic)
    // ========================================================================
    // Paragraph Enter splits text and requires cursor offset logic.
    // This is the ONLY Enter path that uses cursor offset calculations.
    // MANDATORY FALLBACK: This is the mandatory fallback for normal paragraph splitting.
    // If this code does not run, Enter is broken.
    // This ensures that EVERY Enter keypress in a paragraph results in exactly one structural action.
    // e.preventDefault() already called at function start

    const currentText = (focusedBlock.textContent || '').replace(/\u200B/g, '');
    
    // Cursor offset logic is ONLY used for paragraph-to-paragraph splitting.
    // If blockType changed during normalization, originalCursorOffset is INVALID.
    // Only use originalCursorOffset if we're still a paragraph (no normalization occurred).
    let cursorOffset;
    if (blockType === 'paragraph' && originalBlockType === 'paragraph') {
      // Paragraph-to-paragraph splitting: use pre-normalization offset
      cursorOffset = originalCursorOffset;
    } else {
      // BlockType changed during normalization: offset is INVALID, recompute from live selection
      const currentSelection = window.getSelection();
      if (!currentSelection.rangeCount) {
        throw new Error('No selection after normalization - structural violation');
      }
      cursorOffset = this.getTextOffsetInBlock(focusedBlock, currentSelection);
    }
    
    // Ensure cursor offset is within bounds
    if (cursorOffset < 0) cursorOffset = 0;
    if (cursorOffset > currentText.length) cursorOffset = currentText.length;
    
    // Split text into before and after cursor
    const beforeText = currentText.substring(0, cursorOffset);
    const afterText = currentText.substring(cursorOffset);

    // Update current block text in DOM
    focusedBlock.textContent = beforeText;

    // Create new paragraph block in DOM
    // ILLEGAL: Enter completion MUST create a new block. If no block is created here, this is a bug.
    const editor = focusedBlock.parentNode;
    const newBlockElement = document.createElement('p');
    const newBlockId = generateBlockId(this.getBlockCount());
    newBlockElement.setAttribute('data-block-id', newBlockId);
    newBlockElement.setAttribute('data-block-type', 'paragraph');
    newBlockElement.contentEditable = 'true';
    // ILLEGAL: Blocks MUST have a text node. textContent creates one. If missing, this is a bug.
    // ENTER completion must ensure new blocks contain a caret anchor for stable cursor placement.
    if (afterText.length === 0) {
      // Empty block: ensure caret anchor exists for cursor placement
      const caretAnchor = document.createTextNode('\u200B');
      newBlockElement.appendChild(caretAnchor);
    } else {
    newBlockElement.textContent = afterText;
    }
    
    // Insert after current block
    if (focusedBlock.nextSibling) {
      editor.insertBefore(newBlockElement, focusedBlock.nextSibling);
    } else {
      editor.appendChild(newBlockElement);
    }
    didMutateStructure = true;

    // Update placeholder visibility
    this.updatePlaceholderVisibility();

    // Enter completion is the sole authority for cursor placement.
    // ILLEGAL: Cursor placement MUST ONLY occur in Enter completion. If placed elsewhere, this is a bug.
    // Cursor placement is deterministic: always at offset 0 of the text node.
    // ENTER completion ensures the editor is in a stable state with exactly one active block
    // and a valid collapsed selection inside that block.
    // ILLEGAL: Selection recovery is forbidden. Selection is captured once, cursor is placed deterministically.
    const newRange = document.createRange();
    const newSelection = window.getSelection();
    const textNode = newBlockElement.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
      throw new Error('Enter completion created block without text node - structural violation');
    }
        newRange.setStart(textNode, 0);
        newRange.setEnd(textNode, 0);
    newSelection.removeAllRanges();
    newSelection.addRange(newRange);
    newBlockElement.focus();
    this.autoScrollToCaret();
    
    // Postcondition enforcement: every Enter must result in exactly one structural mutation
    // EXCEPTION: Code blocks allow didMutateStructure = false when Enter inserts a newline
    // This is the ONLY whitelisted exception to the postcondition
    if (!didMutateStructure && blockType !== 'code') {
      throw new Error('Enter key violated postcondition: no structural mutation occurred');
    }
  }

  /**
   * Handle SHIFT+ENTER key - insert soft newline
   * Editor is the SOLE authority over structural mutations, including soft newlines.
   * SHIFT+ENTER inserts a newline that the editor tracks internally.
   */
  handleShiftEnterKey(e) {
    // Prevent browser default behavior - editor controls all newline insertion
    e.preventDefault();

    const focusedBlock = this.getFocusedBlock();
    if (!focusedBlock) {
      return;
    }

    const blockType = focusedBlock.getAttribute('data-block-type');
    const selection = window.getSelection();
    if (!selection.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);

    // For code blocks, SHIFT+ENTER behaves the same as ENTER (insert newline)
    if (blockType === 'code') {
      // Use the same logic as ENTER in code blocks - insert newline character
      const container = range.startContainer;
      if (container.nodeType === Node.TEXT_NODE && container.parentNode === focusedBlock) {
        // Cursor is in a text node directly inside PRE: insert newline directly
        const offset = range.startOffset;
        const text = container.textContent;
        container.textContent = text.substring(0, offset) + '\n' + text.substring(offset);
        // Place cursor after the newline
        const newRange = document.createRange();
        newRange.setStart(container, offset + 1);
        newRange.setEnd(container, offset + 1);
        selection.removeAllRanges();
        selection.addRange(newRange);
      } else {
        // Cursor is in PRE element or not in a direct text node:
        // Calculate text offset and insert newline into text content
        let insertOffset = 0;
        const walker = document.createTreeWalker(
          focusedBlock,
          NodeFilter.SHOW_TEXT,
          null
        );
        let node = walker.nextNode();
        while (node) {
          if (node === range.startContainer) {
            insertOffset += range.startOffset;
            break;
          }
          insertOffset += node.textContent.replace(/\u200B/g, '').length;
          node = walker.nextNode();
        }
        
        // Get all text content and insert newline
        const codeText = (focusedBlock.textContent || '').replace(/\u200B/g, '');
        const newText = codeText.substring(0, insertOffset) + '\n' + codeText.substring(insertOffset);
        
        // Replace all child nodes with a single text node containing the updated text
        while (focusedBlock.firstChild) {
          focusedBlock.removeChild(focusedBlock.firstChild);
        }
        const newTextNode = document.createTextNode(newText);
        focusedBlock.appendChild(newTextNode);
        
        // Place cursor after the inserted newline
        const newRange = document.createRange();
        newRange.setStart(newTextNode, insertOffset + 1);
        newRange.setEnd(newTextNode, insertOffset + 1);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
      return;
    }

    // For paragraphs and other text blocks, insert <br> element for soft newline
    // This creates a line break within the same block (editor-tracked)
    if (blockType === 'paragraph' || blockType === 'list-item' || blockType === 'blockquote') {
      // Delete any selected content first
      if (!range.collapsed) {
        range.deleteContents();
      }

      // Insert <br> element at cursor position
      const br = document.createElement('br');
      range.insertNode(br);
      
      // Move cursor after the <br>
      range.setStartAfter(br);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      // Normalize adjacent text nodes if needed
      if (br.nextSibling && br.nextSibling.nodeType === Node.TEXT_NODE && br.previousSibling && br.previousSibling.nodeType === Node.TEXT_NODE) {
        // Both sides are text nodes - this is fine, no normalization needed
      } else if (br.nextSibling && br.nextSibling.nodeType === Node.TEXT_NODE) {
        focusedBlock.normalize();
      }

      // Schedule serialization to update editor state
      this.scheduleSerialization();
      this.updatePlaceholderVisibility();
      
      return;
    }

    // For other block types (heading, image, rawhtml), SHIFT+ENTER does nothing
    // (or could beep/feedback, but silently ignoring is acceptable)
  }

  /**
   * Handle Backspace key - merge with previous block if at start, or delete image if adjacent
   * DOM is authoritative: sync from DOM FIRST
   */
  handleBackspaceKey(e) {
    // Check if an image is selected first
    const selectedImage = document.querySelector('.stack-image-selected');
    if (selectedImage) {
      e.preventDefault();
      this.deleteSelectedImage(selectedImage);
      return;
    }

    const focusedBlock = this.getFocusedBlock();
    if (!focusedBlock) return;

    const blockType = focusedBlock.getAttribute('data-block-type');
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    // Don't allow caret to enter image blocks - move to previous block
    if (blockType === 'image') {
      e.preventDefault();
      
      // A2: Order derived from DOM position, not cached index
        const editor = focusedBlock.parentNode;
        const allBlocks = Array.from(editor.querySelectorAll('[data-block-id]'));
      const blockIndex = allBlocks.indexOf(focusedBlock);
      // Move caret to previous block if it exists
      if (blockIndex > 0) {
        const prevBlockEl = allBlocks[blockIndex - 1];
        if (prevBlockEl) {
          setTimeout(() => {
            if (prevBlockEl && prevBlockEl.hasAttribute('contenteditable')) {
              const newRange = document.createRange();
              const newSelection = window.getSelection();
              if (prevBlockEl.firstChild && prevBlockEl.firstChild.nodeType === Node.TEXT_NODE) {
                const textLength = prevBlockEl.firstChild.textContent.length;
                newRange.setStart(prevBlockEl.firstChild, textLength);
                newRange.setEnd(prevBlockEl.firstChild, textLength);
              } else {
                newRange.setStart(prevBlockEl, prevBlockEl.childNodes.length);
                newRange.setEnd(prevBlockEl, prevBlockEl.childNodes.length);
              }
              newSelection.removeAllRanges();
              newSelection.addRange(newRange);
              prevBlockEl.focus();
            }
          }, 0);
        }
      }
      return;
    }

    // Handle removal of block formatting when cursor is at start of block-formatted line
      const cursorOffset = this.getTextOffsetInBlock(focusedBlock, selection);
      const isAtStart = cursorOffset === 0;

    if (isAtStart && (blockType === 'list-item' || blockType === 'blockquote' || blockType === 'heading')) {
      // REMOVE BLOCK FORMATTING: Convert back to paragraph IN PLACE
          e.preventDefault();
          
      const blockText = (focusedBlock.textContent || '').replace(/\u200B/g, '');

      // Convert in place
      if (blockType === 'heading') {
        // Replace heading with paragraph
        const newParagraph = document.createElement('p');
        Array.from(focusedBlock.attributes).forEach(attr => {
          if (attr.name !== 'data-block-type' && attr.name !== 'class') {
            newParagraph.setAttribute(attr.name, attr.value);
          }
        });
        newParagraph.setAttribute('data-block-type', 'paragraph');
        newParagraph.contentEditable = 'true';
        newParagraph.textContent = blockText || '\u200B';
        focusedBlock.parentNode.replaceChild(newParagraph, focusedBlock);
        
        // Restore cursor synchronously
              const newRange = document.createRange();
              const newSelection = window.getSelection();
        const textNode = newParagraph.firstChild;
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          newRange.setStart(textNode, 0);
          newRange.setEnd(textNode, 0);
              } else {
          newRange.setStart(newParagraph, 0);
          newRange.setEnd(newParagraph, 0);
              }
              newSelection.removeAllRanges();
              newSelection.addRange(newRange);
        newParagraph.focus();
      } else {
        // Convert list-item/blockquote in place
        focusedBlock.setAttribute('data-block-type', 'paragraph');
        focusedBlock.classList.remove('stack-list-item', 'stack-blockquote');
        if (blockText.length === 0) {
          focusedBlock.textContent = '';
          focusedBlock.appendChild(document.createTextNode('\u200B'));
        }
        
        // Restore cursor synchronously
        const newRange = document.createRange();
        const newSelection = window.getSelection();
        const textNode = focusedBlock.firstChild;
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          newRange.setStart(textNode, 0);
          newRange.setEnd(textNode, 0);
        } else {
          newRange.setStart(focusedBlock, 0);
          newRange.setEnd(focusedBlock, 0);
        }
        newSelection.removeAllRanges();
        newSelection.addRange(newRange);
        focusedBlock.focus();
      }
      
          this.updatePlaceholderVisibility();
          return;
        }
        
    // Handle deletion when caret is at start of paragraph
    // A2: Order derived from DOM position, not cached index
    if (blockType === 'paragraph' && isAtStart) {
        const editor = focusedBlock.parentNode;
        const allBlocks = Array.from(editor.querySelectorAll('[data-block-id]'));
      const blockIndex = allBlocks.indexOf(focusedBlock);
      if (blockIndex > 0) {
        const prevBlockEl = allBlocks[blockIndex - 1];
        
        // If previous block is an image, delete it from DOM
        if (prevBlockEl && prevBlockEl.getAttribute('data-block-type') === 'image') {
          e.preventDefault();
          if (prevBlockEl) {
            prevBlockEl.remove();
            this.updatePlaceholderVisibility();
            
            // Focus current block synchronously
              const newRange = document.createRange();
              const newSelection = window.getSelection();
            const textNode = focusedBlock.firstChild;
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
              newRange.setStart(textNode, 0);
              newRange.setEnd(textNode, 0);
              } else {
              newRange.setStart(focusedBlock, 0);
              newRange.setEnd(focusedBlock, 0);
              }
              newSelection.removeAllRanges();
              newSelection.addRange(newRange);
            focusedBlock.focus();
          }
          return;
        }
        
        // A3: DOM-authoritative - check previous block from DOM, not legacy model
        if (prevBlockEl && prevBlockEl.getAttribute('data-block-type') === 'paragraph') {
          e.preventDefault();
          
            const prevText = (prevBlockEl.textContent || '').replace(/\u200B/g, '');
            const currText = (focusedBlock.textContent || '').replace(/\u200B/g, '');
            
            // Merge in DOM
            prevBlockEl.textContent = prevText + currText;
            focusedBlock.remove();
            
            // Restore cursor synchronously
          this.updatePlaceholderVisibility();
          
              const newRange = document.createRange();
              const newSelection = window.getSelection();
            const textNode = prevBlockEl.firstChild;
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
              newRange.setStart(textNode, prevText.length);
              newRange.setEnd(textNode, prevText.length);
              } else {
              newRange.setStart(prevBlockEl, 0);
              newRange.setEnd(prevBlockEl, 0);
              }
              newSelection.removeAllRanges();
              newSelection.addRange(newRange);
            prevBlockEl.focus();
          return;
        }
      }
    }

    // Allow default backspace behavior for other cases
  }

  /**
   * Handle Delete key - merge with next block if at end, or delete image if adjacent
   * DOM is authoritative: sync from DOM FIRST
   */
  handleDeleteKey(e) {
    // Check if an image is selected first
    const selectedImage = document.querySelector('.stack-image-selected');
    if (selectedImage) {
      e.preventDefault();
      this.deleteSelectedImage(selectedImage);
      return;
    }

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const focusedBlock = this.getFocusedBlock();
    if (!focusedBlock) return;

    const blockType = focusedBlock.getAttribute('data-block-type');

    // If cursor is at the end of a paragraph block
    if (blockType === 'paragraph' && range.collapsed) {
      const cursorOffset = this.getTextOffsetInBlock(focusedBlock, selection);
      const blockText = (focusedBlock.textContent || '').replace(/\u200B/g, '');
      const isAtEnd = cursorOffset >= blockText.length;
      
      if (isAtEnd) {
        e.preventDefault();

        const editor = focusedBlock.parentNode;
        const allBlocks = Array.from(editor.querySelectorAll('[data-block-id]'));
        // A2: Order derived from DOM position, not cached index
        const blockIndex = allBlocks.indexOf(focusedBlock);
      const nextBlockIndex = blockIndex + 1;
        if (nextBlockIndex >= allBlocks.length) {
        return;
      }

        const nextBlockEl = allBlocks[nextBlockIndex];
        if (!nextBlockEl) return;

        const nextBlockType = nextBlockEl.getAttribute('data-block-type');
        if (nextBlockType === 'image' || nextBlockType === 'rawhtml') {
          // Delete the next block from DOM
          nextBlockEl.remove();
        this.updatePlaceholderVisibility();

          // Keep cursor at the end of the current block synchronously
            const newRange = document.createRange();
            const newSelection = window.getSelection();
          const textNode = focusedBlock.firstChild;
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
              newRange.setStart(textNode, textNode.textContent.length);
              newRange.setEnd(textNode, textNode.textContent.length);
            } else {
            newRange.setStart(focusedBlock, 0);
            newRange.setEnd(focusedBlock, 0);
            }
            newSelection.removeAllRanges();
            newSelection.addRange(newRange);
          focusedBlock.focus();
        return;
      } else if (nextBlockType === 'paragraph' || nextBlockType === 'heading') {
        // A3: DOM-authoritative - merge next block into current in DOM
          const currText = (focusedBlock.textContent || '').replace(/\u200B/g, '');
          const nextText = (nextBlockEl.textContent || '').replace(/\u200B/g, '');
          
          focusedBlock.textContent = currText + nextText;
          nextBlockEl.remove();
        this.updatePlaceholderVisibility();

          // Keep cursor at the merge point synchronously
            const newRange = document.createRange();
            const newSelection = window.getSelection();
          const textNode = focusedBlock.firstChild;
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            newRange.setStart(textNode, currText.length);
            newRange.setEnd(textNode, currText.length);
            } else {
            newRange.setStart(focusedBlock, 0);
            newRange.setEnd(focusedBlock, 0);
            }
            newSelection.removeAllRanges();
            newSelection.addRange(newRange);
          focusedBlock.focus();
        return;
        }
      }
    } else if (focusedBlock.getAttribute('data-block-type') === 'image') {
      // If an image block is somehow focused, delete it from DOM
      e.preventDefault();
      focusedBlock.remove();
      this.updatePlaceholderVisibility();
      return;
    }
    // Allow default browser behavior for other cases
  }

  /**
   * Structural conversion is Enter-authoritative to ensure deterministic behavior.
   * No structural conversion occurs during input events to avoid race conditions,
   * empty blocks, stale selection, and cursor jumps.
   * 
   * All structural conversion (headings, lists, blockquotes) is handled in handleEnterKey() only.
   */
  checkAutoConversion(e) {
    // Structural conversion is handled on Enter only.
    // This function is kept as a placeholder for potential future non-structural conversions.
    return false;
  }

  /**
   * Handle input events - update document model
   * DOM is authoritative: always read from DOM to update state
   */
  handleEditorInput(e) {
    // Structural conversion is Enter-authoritative - no conversion during input events
    // checkAutoConversion() is now a no-op; all conversion happens in handleEnterKey()

    const focusedBlock = this.getFocusedBlock();
    if (!focusedBlock) return;

    // Schedule serialization (reads from DOM)
    // This respects IME composition state and save thresholds
      this.scheduleSerialization();

    // Update placeholder visibility immediately when user types
    this.updatePlaceholderVisibility();
    
    // Update next step button state
    this.updateNextStepButton();

    // Auto-scroll to keep caret visible
    this.autoScrollToCaret();
  }

  /**
   * Auto-scroll editor container to keep caret visible
   * Only scrolls when caret is near or past viewport edges
   */
  autoScrollToCaret() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    
    // Don't scroll if selection spans multiple lines
    if (!range.collapsed) {
      // Check if selection spans multiple blocks
      const startBlock = range.startContainer.nodeType === Node.TEXT_NODE 
        ? range.startContainer.parentElement.closest('[data-block-id]')
        : range.startContainer.closest('[data-block-id]');
      const endBlock = range.endContainer.nodeType === Node.TEXT_NODE
        ? range.endContainer.parentElement.closest('[data-block-id]')
        : range.endContainer.closest('[data-block-id]');
      
      if (startBlock !== endBlock) {
        return; // Multi-block selection, don't auto-scroll
      }
    }

    // Get caret position
    const caretRect = range.getBoundingClientRect();
    
    // Get editor container (scrollable wrapper)
    const editor = document.querySelector('#stack-post-body-editor');
    if (!editor) return;
    
    const container = editor.closest('.stack-post-body-field');
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    
    // Calculate distances from caret to container edges
    const caretTop = caretRect.top;
    const caretBottom = caretRect.bottom;
    const containerTop = containerRect.top;
    const containerBottom = containerRect.bottom;
    
    const threshold = 48; // ~48px threshold
    
    // Check if caret is near or past bottom edge
    if (caretBottom >= containerBottom - threshold) {
      // Scroll down incrementally - just enough to bring caret into comfortable view
      const scrollDelta = caretBottom - (containerBottom - threshold);
      // Add a bit more to keep caret comfortably visible
      container.scrollTop += scrollDelta + threshold;
    }
    // Check if caret is above container top
    else if (caretTop < containerTop) {
      // Scroll up incrementally - just enough to bring caret into view
      const scrollDelta = containerTop - caretTop;
      // Add a bit more to keep caret comfortably visible
      container.scrollTop -= scrollDelta + threshold;
    }
    // Caret is comfortably visible, no scrolling needed
  }

  /**
   * Handle paste events - support images and text
   */
  async handlePaste(e) {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    // Check for image in clipboard
    const items = Array.from(clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));

    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      await this.insertImageAtCursor(file);
      // Auto-scroll after paste
      setTimeout(() => {
        this.autoScrollToCaret();
      }, 0);
      return;
    }

    // Handle text paste - let default behavior happen, then process
    // Auto-scroll will be handled by input event
  }

  /**
   * Handle drag over - show insertion indicator and store insertion point as single source of truth
   */
  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();

    // Check if dragging files
    if (!e.dataTransfer.types.includes('Files')) {
      return;
    }

    const editor = document.querySelector('#stack-post-body-editor');
    if (!editor) return;

    this.isDragging = true;

    // Find insertion point for visual indicator - this is the single source of truth
    const insertionPoint = this.findInsertionPoint(e.clientY);
    
    if (insertionPoint) {
      // Store the insertion point that matches the visual indicator
      // Update on every dragover so it always matches the current indicator position
      // This ensures the drop position matches where the indicator is when drop happens
      this.storedInsertionPoint = {
        position: insertionPoint.position,
        element: insertionPoint.element,
        index: insertionPoint.index, // Document model index, not DOM index
        splitBlock: insertionPoint.splitBlock ? { ...insertionPoint.splitBlock } : null
      };
      
      // Show visual indicator at this exact position (only moves if position changed)
      this.showInsertionIndicator(insertionPoint);
    } else {
      // If insertionPoint is null, clear stored point to avoid stale data
      // This shouldn't happen in normal flow, but protects against edge cases
      this.storedInsertionPoint = null;
      this.removeInsertionIndicators();
    }

    e.dataTransfer.dropEffect = 'copy';
  }

  /**
   * Handle drag leave - remove insertion indicator (but keep stored insertion point)
   */
  handleDragLeave(e) {
    // Only remove if we're leaving the editor entirely
    const editor = document.querySelector('#stack-post-body-editor');
    if (editor && !editor.contains(e.relatedTarget)) {
      this.removeInsertionIndicators();
      this.isDragging = false;
      // DO NOT clear storedInsertionPoint here - keep it frozen until drop
    }
  }

  /**
   * Handle drop - insert image at drop point using stored insertion point (single source of truth)
   */
  async handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    this.removeInsertionIndicators();
    this.isDragging = false;

    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) {
      this.storedInsertionPoint = null;
      this.storedDropRange = null;
      return;
    }

    // Use the STORED INSERTION POINT as single source of truth
    // This matches exactly what the visual indicator showed
    const storedInsertionPoint = this.storedInsertionPoint;
    this.storedInsertionPoint = null; // Clear after use
    this.storedDropRange = null; // Clear legacy reference

    if (!storedInsertionPoint) {
      // Fallback: if no stored insertion point, use end of document
      console.warn('No stored insertion point, inserting at end');
      await this.insertImageAtCursor(files[0], null);
      return;
    }

    // Use the first image file with the stored insertion point
    await this.insertImageAtCursor(files[0], storedInsertionPoint);
  }

  /**
   * Find insertion point based on Y coordinate
   * Handles both between blocks and within blocks (e.g., between <br> tags)
   */
  findInsertionPoint(clientY) {
    const editor = document.querySelector('#stack-post-body-editor');
    if (!editor) return null;

    const blocks = Array.from(editor.children);
    if (blocks.length === 0) return { position: 'before', element: null, index: 0, splitBlock: null };

    // Check if we're before the first block
    if (blocks.length > 0) {
      const firstBlock = blocks[0];
      const firstRect = firstBlock.getBoundingClientRect();
      if (clientY < firstRect.top) {
        return { position: 'before', element: firstBlock, index: 0, splitBlock: null };
      }
    }

    // First, check if we're over a paragraph block that might contain <br> tags
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const rect = block.getBoundingClientRect();
      
      // Check if Y coordinate is within this block
      if (clientY >= rect.top && clientY <= rect.bottom) {
        const blockType = block.getAttribute('data-block-type');
        
        // A2: Order derived from DOM position (loop index), not cached index
        const blockIndex = i;
        
        // For paragraph blocks, check if we're over a line break area
        if (blockType === 'paragraph') {
          const splitPoint = this.findSplitPointInBlock(block, clientY);
          if (splitPoint) {
            return {
              position: 'split',
              element: block,
              index: blockIndex,
              splitBlock: splitPoint
            };
          }
        }
        
        // If we're in the upper half, insert before
        const blockMiddle = rect.top + rect.height / 2;
        if (clientY < blockMiddle) {
          return { position: 'before', element: block, index: blockIndex, splitBlock: null };
        } else {
          // In lower half, insert after
          return { position: 'after', element: block, index: blockIndex + 1, splitBlock: null };
        }
      }
      
      // Check if we're in a gap BETWEEN blocks (not inside any block)
      // If we're past the current block's bottom but before the next block's top
      if (i < blocks.length - 1) {
        const nextBlock = blocks[i + 1];
        const nextRect = nextBlock.getBoundingClientRect();
        
        // If mouse is between current block bottom and next block top
        if (clientY > rect.bottom && clientY < nextRect.top) {
          // A2: Order derived from DOM position (loop index)
          const blockIndex = i;
          
          // Insert after the current block (in the gap)
          return { position: 'after', element: block, index: blockIndex + 1, splitBlock: null };
        }
      }
    }

    // After last block - use DOM position
    const lastBlock = blocks[blocks.length - 1];
    const lastIndex = blocks.length - 1;
    return { position: 'after', element: lastBlock, index: lastIndex + 1, splitBlock: null };
  }

  /**
   * Find split point from a Range within a block
   * @param {Element} block - Block element
   * @param {Node} container - Container node from Range
   * @param {number} offset - Offset in container
   * @returns {Object|null} Split information or null
   */
  findSplitPointInBlockFromRange(block, container, offset) {
    if (!block || !container) return null;

    // Check if we're at or near a <br> element
    let node = container;
    if (container.nodeType === Node.TEXT_NODE) {
      node = container.parentNode;
    }

    // Walk to find <br> elements
    const brElements = Array.from(block.querySelectorAll('br'));
    for (const br of brElements) {
      const range = document.createRange();
      range.setStart(block, 0);
      range.setEndBefore(br);
      const beforeText = range.toString();
      
      range.setStartAfter(br);
      range.setEnd(block, block.childNodes.length);
      const afterText = range.toString();

      // Check if our offset is near this <br>
      const beforeLength = beforeText.length;
      if (Math.abs(offset - beforeLength) < 2) {
        return {
          brNode: br,
          beforeText: beforeText.trim(),
          afterText: afterText.trim()
        };
      }
    }

    return null;
  }

  /**
   * Find if we should split a block at a line break area
   * Returns split information if we're over a <br> area or blank line, null otherwise
   */
  findSplitPointInBlock(block, clientY) {
    const rect = block.getBoundingClientRect();
    
    // Try to use caretRangeFromPoint or caretPositionFromPoint to find exact position
    let range = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(clientY, rect.left + rect.width / 2);
    } else if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(clientY, rect.left + rect.width / 2);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.setEnd(pos.offsetNode, pos.offset);
      }
    }
    
    // If we got a range, use it to find split point
    if (range && range.startContainer) {
      const container = range.startContainer;
      let splitNode = null;
      let offset = range.startOffset;
      
      // If container is the block itself, find the child node at that offset
      if (container === block) {
        if (block.childNodes[offset]) {
          splitNode = block.childNodes[offset];
        } else if (offset > 0 && block.childNodes[offset - 1]) {
          splitNode = block.childNodes[offset - 1];
        }
      } else {
        // Container is a child node
        splitNode = container;
      }
      
      // Check if we're at or near a <br> element
      if (splitNode && splitNode.tagName === 'BR') {
        const beforeText = this.getTextBeforeNode(block, splitNode);
        const afterText = this.getTextAfterNode(block, splitNode);
        return {
          brNode: splitNode,
          beforeText: beforeText.trim(),
          afterText: afterText.trim()
        };
      }
      
      // If we're in a text node, find the nearest <br> or line break
      if (splitNode && splitNode.nodeType === Node.TEXT_NODE) {
        // Walk backwards to find previous <br>
        let prevNode = splitNode.previousSibling;
        while (prevNode) {
          if (prevNode.tagName === 'BR') {
            const beforeText = this.getTextBeforeNode(block, prevNode);
            const afterText = this.getTextAfterNode(block, prevNode);
            return {
              brNode: prevNode,
              beforeText: beforeText.trim(),
              afterText: afterText.trim()
            };
          }
          prevNode = prevNode.previousSibling;
        }
        
        // Walk forwards to find next <br>
        let nextNode = splitNode.nextSibling;
        while (nextNode) {
          if (nextNode.tagName === 'BR') {
            const beforeText = this.getTextBeforeNode(block, nextNode);
            const afterText = this.getTextAfterNode(block, nextNode);
            return {
              brNode: nextNode,
              beforeText: beforeText.trim(),
              afterText: afterText.trim()
            };
          }
          nextNode = nextNode.nextSibling;
        }
        
        // No <br> found, but we can still split at the text position
        const fullText = block.textContent || '';
        let charPos = 0;
        
        // Calculate character position
        const walker = document.createTreeWalker(
          block,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let textNode = walker.nextNode();
        while (textNode && textNode !== splitNode) {
          charPos += textNode.textContent.length;
          textNode = walker.nextNode();
        }
        
        if (textNode === splitNode) {
          charPos += offset;
        }
        
        const beforeText = fullText.substring(0, charPos).trim();
        const afterText = fullText.substring(charPos).trim();
        
        if (beforeText || afterText) {
          return {
            brNode: null,
            beforeText: beforeText,
            afterText: afterText,
            estimated: true
          };
        }
      }
    }
    
    // Fallback: check all <br> elements
    const brElements = Array.from(block.querySelectorAll('br'));
    let closestBr = null;
    let closestDistance = Infinity;
    
    for (const br of brElements) {
      const brRect = br.getBoundingClientRect();
      const brY = brRect.top + brRect.height / 2;
      const distance = Math.abs(clientY - brY);
      
      if (distance < closestDistance && distance < 30) {
        closestDistance = distance;
        closestBr = br;
      }
    }
    
    if (closestBr) {
      const beforeText = this.getTextBeforeNode(block, closestBr);
      const afterText = this.getTextAfterNode(block, closestBr);
      return {
        brNode: closestBr,
        beforeText: beforeText.trim(),
        afterText: afterText.trim()
      };
    }
    
    return null;
  }

  /**
   * Get text content before a specific node within a block
   */
  getTextBeforeNode(block, targetNode) {
    const range = document.createRange();
    range.setStart(block, 0);
    range.setEndBefore(targetNode);
    return range.toString();
  }

  /**
   * Get text content after a specific node within a block
   */
  getTextAfterNode(block, targetNode) {
    const range = document.createRange();
    range.setStartAfter(targetNode);
    range.setEnd(block, block.childNodes.length);
    return range.toString();
  }

  /**
   * Show insertion indicator between blocks or at split point
   * Optimized to only move indicator when position actually changes
   */
  showInsertionIndicator(insertionPoint) {
    const editor = document.querySelector('#stack-post-body-editor');
    if (!editor || !insertionPoint) return;

    let indicator = document.querySelector('.stack-insertion-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'stack-insertion-indicator';
      editor.appendChild(indicator);
    }

    // Determine where the indicator should be
    let targetSibling = null;
    if (insertionPoint.position === 'split' && insertionPoint.splitBlock && insertionPoint.element) {
      // Show indicator after the block that will be split
      const block = insertionPoint.element;
      targetSibling = block.nextSibling;
    } else if (insertionPoint.position === 'before' && insertionPoint.element) {
      targetSibling = insertionPoint.element;
    } else if (insertionPoint.position === 'after' && insertionPoint.element) {
      targetSibling = insertionPoint.element.nextSibling;
    } else if (insertionPoint.position === 'before' && !insertionPoint.element) {
      // First block (no element means before first)
      targetSibling = editor.firstChild;
    } else {
      // Fallback: append to end
      targetSibling = null;
    }

    // Only move indicator if it's not already in the correct position
    // Check if indicator's nextSibling matches the target
    const currentNextSibling = indicator.nextSibling;
    if (currentNextSibling !== targetSibling) {
      if (targetSibling && targetSibling !== indicator) {
        // Only move if target is not the indicator itself (prevents infinite loops)
        editor.insertBefore(indicator, targetSibling);
      } else if (targetSibling === null) {
        // No target sibling means append to end
        // Only move if indicator is not already at the end
        if (indicator.parentNode !== editor || indicator.nextSibling !== null) {
          editor.appendChild(indicator);
        }
      }
    }
  }

  /**
   * Remove insertion indicators
   */
  removeInsertionIndicators() {
    const indicators = document.querySelectorAll('.stack-insertion-indicator');
    indicators.forEach(indicator => indicator.remove());
  }

  /**
   * Insert image at cursor position or drop point
   * @param {File} file - Image file to insert
   * @param {Object|null} dropPosition - Stored insertionPoint object (single source of truth), or null for cursor
   */
  async insertImageAtCursor(file, dropPosition = null) {
    if (!file || !file.type.startsWith('image/')) return;

    // Read file as data URL
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Optionally resize image (using existing infrastructure)
    let imageDataUrl = dataUrl;
    if (this.app.browser && this.app.browser.resizeImg) {
      try {
        imageDataUrl = await this.app.browser.resizeImg(dataUrl);
      } catch (err) {
        console.warn('Image resize failed, using original:', err);
      }
    }

    // Extract base64 data (for storage)
    const base64Data = imageDataUrl.split(',')[1] || '';

    // Determine insertion index using stored insertion point (single source of truth)
    // Default to end only if we have no position information
    let insertIndex = -1; // Use -1 to indicate "not set" - we'll validate later
    let needsBlockSplit = false;
    let splitInfo = null;
    let blockToSplitIndex = -1;
    
    if (dropPosition) {
      // Use stored insertion point - this matches exactly what the visual indicator showed
      // dropPosition is the storedInsertionPoint object with: position, element, index, splitBlock
      insertIndex = dropPosition.index;
      blockToSplitIndex = dropPosition.index;
      
      if (dropPosition.position === 'split' && dropPosition.splitBlock) {
        needsBlockSplit = true;
        splitInfo = dropPosition.splitBlock;
        // When splitting, insert after the split (at index + 1)
        insertIndex = dropPosition.index + 1;
      } else if (dropPosition.position === 'before') {
        // Insert before the element at this index
        insertIndex = dropPosition.index;
      } else if (dropPosition.position === 'after') {
        // Insert after the element at this index
        insertIndex = dropPosition.index;
      }
    } else {
      // Cursor position (no drop position provided)
      const focusedBlock = this.getFocusedBlock();
      if (focusedBlock) {
        // Get all blocks in DOM order (A2: Order derived from DOM position)
        const editor = document.querySelector('#stack-post-body-editor');
        if (editor) {
          const allBlocks = Array.from(editor.querySelectorAll('[data-block-id]'));
          const blockIndex = allBlocks.indexOf(focusedBlock);
          
          if (blockIndex >= 0) {
            // Get cursor position within the block to determine insertion point
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              const cursorOffset = this.getTextOffsetInBlock(focusedBlock, selection);
              
              // If cursor is at the start of the block (offset 0), insert before it
              // This allows images to be inserted at index 0 (first element)
              if (cursorOffset === 0) {
                insertIndex = blockIndex; // Insert before current block
              } else {
                // If cursor is at end or middle, insert after the block
                insertIndex = blockIndex + 1;
              }
            } else {
              // No selection, default to after the block
              insertIndex = blockIndex + 1;
            }
          } else {
            // Block not found, insert at end
            insertIndex = allBlocks.length;
          }
        } else {
          // No editor, should not happen but default to 0
          insertIndex = 0;
        }
      } else {
        // No focused block, insert at end
        const editor = document.querySelector('#stack-post-body-editor');
        if (editor) {
        insertIndex = this.getBlockCount();
        } else {
          insertIndex = 0;
        }
      }
    }

    // Get editor reference
    const editor = document.querySelector('#stack-post-body-editor');
    if (!editor) return;

    // Validate insertIndex - clamp to valid range
    const blockCount = this.getBlockCount();
    if (insertIndex < 0) {
      insertIndex = blockCount;
    } else if (insertIndex > blockCount) {
      // If index is beyond document length, clamp to end
      insertIndex = blockCount;
    }

    // If we need to split a block, do it first in DOM
    if (needsBlockSplit && splitInfo && blockToSplitIndex >= 0 && blockToSplitIndex < blockCount) {
      const allBlocks = Array.from(editor.querySelectorAll('[data-block-id]'));
      const blockToSplitEl = allBlocks[blockToSplitIndex];
      if (blockToSplitEl && blockToSplitEl.getAttribute('data-block-type') === 'paragraph') {
        if (blockToSplitEl) {
        // Update the original block with text before the split
          blockToSplitEl.textContent = splitInfo.beforeText.trim();
          
          // Create a new paragraph block with text after the split in DOM
          const afterBlockEl = document.createElement('p');
          const afterBlockId = generateBlockId(this.getBlockCount());
          afterBlockEl.setAttribute('data-block-id', afterBlockId);
          afterBlockEl.setAttribute('data-block-type', 'paragraph');
          afterBlockEl.contentEditable = 'true';
          afterBlockEl.textContent = splitInfo.afterText.trim();
          
          // Insert after the split block
          if (blockToSplitEl.nextSibling) {
            editor.insertBefore(afterBlockEl, blockToSplitEl.nextSibling);
          } else {
            editor.appendChild(afterBlockEl);
          }
        // insertIndex remains correct for the image (after the new after-block)
        }
      }
    }

    // Create image element in DOM
    const imageElement = document.createElement('figure');
    const imageBlockId = generateBlockId(this.getBlockCount());
    imageElement.setAttribute('data-block-id', imageBlockId);
    imageElement.setAttribute('data-block-type', 'image');
    imageElement.className = 'stack-image-block';
    imageElement.contentEditable = false;

    const img = document.createElement('img');
    img.src = imageDataUrl;
    img.alt = file.name || '';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.style.display = 'block';
    img.style.margin = '0 auto';
    imageElement.appendChild(img);

    // Create new paragraph element in DOM
    const newParagraphElement = document.createElement('p');
    const newParagraphId = generateBlockId(this.getBlockCount() + 1);
    newParagraphElement.setAttribute('data-block-id', newParagraphId);
    newParagraphElement.setAttribute('data-block-type', 'paragraph');
    newParagraphElement.contentEditable = 'true';
    newParagraphElement.textContent = '';
    newParagraphElement.appendChild(document.createTextNode('\u200B'));

    // Insert into DOM at the correct position
    // Images are always direct children of the editor, not nested
    // Get all blocks to find the correct insertion point relative to editor's direct children
    const allBlocks = Array.from(editor.querySelectorAll('[data-block-id]'));
    
    if (insertIndex <= 0) {
      // Insert at the beginning (index 0) - insert as first child
      if (editor.firstChild) {
        editor.insertBefore(imageElement, editor.firstChild);
      } else {
        editor.appendChild(imageElement);
      }
      // Insert paragraph after the image
      if (imageElement.nextSibling) {
        editor.insertBefore(newParagraphElement, imageElement.nextSibling);
      } else {
        editor.appendChild(newParagraphElement);
      }
    } else if (insertIndex >= allBlocks.length) {
      // Insert at the end
      editor.appendChild(imageElement);
      editor.appendChild(newParagraphElement);
        } else {
      // Insert at the specified index - find the block at that index and insert before it (or its parent)
      const targetBlock = allBlocks[insertIndex];
      if (targetBlock) {
        // Find the direct child of editor to insert before
        // If targetBlock is nested (like <li> in <ul>), insert before its parent container
        let insertBeforeElement = targetBlock;
        while (insertBeforeElement && insertBeforeElement.parentNode !== editor) {
          insertBeforeElement = insertBeforeElement.parentNode;
        }
        
        if (insertBeforeElement && insertBeforeElement.parentNode === editor) {
          editor.insertBefore(imageElement, insertBeforeElement);
          // Insert paragraph after the image
          if (imageElement.nextSibling) {
      editor.insertBefore(newParagraphElement, imageElement.nextSibling);
          } else {
            editor.appendChild(newParagraphElement);
          }
        } else {
          // Fallback: append to end
          editor.appendChild(imageElement);
          editor.appendChild(newParagraphElement);
        }
      } else {
        // Fallback: append to end
        editor.appendChild(imageElement);
        editor.appendChild(newParagraphElement);
      }
        }

    // Update placeholder visibility
    this.updatePlaceholderVisibility();

    // Focus the new paragraph synchronously
    const newRange = document.createRange();
    const newSelection = window.getSelection();
    const textNode = newParagraphElement.firstChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      newRange.setStart(textNode, 0);
      newRange.setEnd(textNode, 0);
        } else {
      newRange.setStart(newParagraphElement, 0);
      newRange.setEnd(newParagraphElement, 0);
    }
    newSelection.removeAllRanges();
    newSelection.addRange(newRange);
    newParagraphElement.focus();

    // ========================================================================
    // IMAGE INSERTION MUST TRIGGER AUTOSAVE
    // ========================================================================
    // Image insertion is a document edit - it must mark the document as dirty
    // and trigger autosave logic, just like text edits do.
    // This ensures images persist even if no text changes occur afterward.
    this.scheduleSerialization();
  }

  /**
   * Handle click on image block - toggle selection to show/hide caption
   */
  handleImageClick(imageBlock) {
    // Deselect all images first
    this.deselectAllImages();
    
    // Toggle selection on clicked image
    if (imageBlock.classList.contains('stack-image-selected')) {
      imageBlock.classList.remove('stack-image-selected');
    } else {
      imageBlock.classList.add('stack-image-selected');
    }
  }

  /**
   * Deselect all image blocks
   */
  deselectAllImages() {
    const selectedImages = document.querySelectorAll('.stack-image-selected');
    selectedImages.forEach(img => img.classList.remove('stack-image-selected'));
  }

  /**
   * Update publish trigger visibility based on content (now on Admin element)
   */
  updatePublishTriggerVisibility() {
    const adminElement = document.querySelector('#stack-draft-state');
    if (!adminElement) return;

    // Check if there's meaningful content (read from DOM)
    const editor = document.querySelector('#stack-post-body-editor');
    let hasContent = false;
    if (editor) {
      const blockElements = editor.querySelectorAll('[data-block-id]');
      for (const blockEl of blockElements) {
        const blockType = blockEl.getAttribute('data-block-type');
        if (blockType === 'paragraph' || blockType === 'heading' || blockType === 'list-item' || blockType === 'blockquote') {
          const text = (blockEl.textContent || '').replace(/\u200B/g, '').trim();
          if (text.length > 0) {
            hasContent = true;
            break;
          }
        } else if (blockType === 'image') {
          hasContent = true;
          break;
        } else if (blockType === 'rawhtml') {
          const html = (blockEl.innerHTML || '').trim();
          if (html.length > 0) {
            hasContent = true;
            break;
          }
        }
      }
    }

    if (hasContent) {
      adminElement.classList.add('stack-admin-active');
    } else {
      adminElement.classList.remove('stack-admin-active');
    }
  }

  /**
   * Update publish trigger state (draft/published) - now on Admin element
   */
  updatePublishTriggerState() {
    const adminElement = document.querySelector('#stack-draft-state');
    if (!adminElement) return;

    if (this.isPublished) {
      adminElement.classList.add('stack-admin-published');
      adminElement.setAttribute('title', 'Edit publication');
    } else {
      adminElement.classList.remove('stack-admin-published');
      adminElement.setAttribute('title', 'Publish settings');
    }

    // Update status display to reflect published state (unless currently saving)
    if (this.saveState !== 'saving') {
      this.updateStatusDisplay();
    }
  }

  /**
   * Focus body editor at the end of document content
   * Used when transitioning from title to body (Enter/Tab)
   */
  focusBodyEditorAtEnd() {
    const editor = document.querySelector('#stack-post-body-editor');
    if (!editor) return;

    // Find the last editable block in the document
    const blocks = Array.from(editor.children);
    let targetBlock = null;

    // Work backwards to find the last editable block
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      const blockType = block.getAttribute('data-block-type');
      
      // Skip non-editable blocks (images, etc.)
      if (blockType === 'paragraph' || blockType === 'heading' || blockType === 'rawhtml') {
        if (block.hasAttribute('contenteditable') && block.getAttribute('contenteditable') === 'true') {
          targetBlock = block;
          break;
        }
      }
    }

    // If no editable block found, use the first block or create one
    if (!targetBlock) {
      targetBlock = editor.querySelector('[contenteditable="true"]');
      
      // If still no block, ensure we have at least one paragraph in DOM
      if (!targetBlock && this.getBlockCount() === 0) {
        const { generateBlockId } = require('../post-document');
        const newParagraphEl = document.createElement('p');
        const newParagraphId = generateBlockId(0);
        newParagraphEl.setAttribute('data-block-id', newParagraphId);
        newParagraphEl.setAttribute('data-block-type', 'paragraph');
        newParagraphEl.contentEditable = 'true';
        newParagraphEl.textContent = '';
        newParagraphEl.appendChild(document.createTextNode('\u200B'));
        editor.appendChild(newParagraphEl);
        
        targetBlock = newParagraphEl;
      }
    }

    if (targetBlock) {
      const range = document.createRange();
      const selection = window.getSelection();

      // Find the last text node in the block
      let lastTextNode = null;
      const walker = document.createTreeWalker(
        targetBlock,
        NodeFilter.SHOW_TEXT,
        null
      );

      let textNode = walker.nextNode();
      while (textNode) {
        lastTextNode = textNode;
        textNode = walker.nextNode();
      }

      // Place cursor at the end of the last text node
      if (lastTextNode) {
        const textLength = lastTextNode.textContent.replace(/\u200B/g, '').length;
        const actualLength = lastTextNode.textContent.length;
        range.setStart(lastTextNode, actualLength);
        range.setEnd(lastTextNode, actualLength);
      } else {
        // No text node, place at end of block
        if (targetBlock.firstChild) {
          range.setStartAfter(targetBlock.lastChild);
          range.setEndAfter(targetBlock.lastChild);
        } else {
          // Empty block, create text node and place cursor
          const textNode = document.createTextNode('\u200B');
          targetBlock.appendChild(textNode);
          range.setStart(textNode, 0);
          range.setEnd(textNode, 0);
        }
      }

      selection.removeAllRanges();
      selection.addRange(range);
      targetBlock.focus();

      // Smoothly scroll to make the caret visible
      setTimeout(() => {
        const rect = range.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        const scrollContainer = editor.closest('.stack-post-body-field');
        
        if (scrollContainer && rect) {
          // Check if caret is outside viewport
          const isAboveViewport = rect.top < editorRect.top;
          const isBelowViewport = rect.bottom > editorRect.bottom;
          
          if (isAboveViewport || isBelowViewport) {
            // Calculate scroll position to center the caret
            const scrollTop = scrollContainer.scrollTop;
            const caretRelativeTop = rect.top - editorRect.top + scrollTop;
            const viewportHeight = scrollContainer.clientHeight;
            const targetScroll = caretRelativeTop - (viewportHeight / 2);
            
            scrollContainer.scrollTo({
              top: Math.max(0, targetScroll),
              behavior: 'smooth'
            });
          }
        } else if (targetBlock) {
          // Fallback: scroll the block into view
          targetBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 0);
    } else {
      // Fallback: focus the editor itself
      editor.focus();
    }
  }

  /**
   * Handle publish trigger click - open publish settings overlay
   */
  handlePublishTriggerClick() {
    if (!this.mod.publishSettingsOverlay) {
      const PublishSettingsOverlay = require('./overlay/publish-settings');
      this.mod.publishSettingsOverlay = new PublishSettingsOverlay(this.app, this.mod);
    }

    // Get current post data
    const title = document.querySelector('#stack-post-title-input')?.value || '';
    const editor = document.querySelector('#stack-post-body-editor');
    const content = editor ? this.serializeDOMToMarkdown() : '';

    // Get featured image from editor state
    const featuredImage = this.featuredImage || null;

    this.mod.publishSettingsOverlay.render({
      published: this.isPublished,
      description: content.substring(0, 200).replace(/\n/g, ' ').trim(),
      image: featuredImage,
      imageUrl: null // Featured image is always base64, no URL
    });
  }

  /**
   * Delete a selected image block
   */
  deleteSelectedImage(imageElement) {
    const blockId = imageElement.getAttribute('data-block-id');
    if (!blockId) return;

    // Find target element BEFORE removing (to move caret to)
    const editor = document.querySelector('#stack-post-body-editor');
    if (!editor) return;

    let targetElement = null;
    
    // Try to find a paragraph block after the image
    const nextSibling = imageElement.nextSibling;
    if (nextSibling && nextSibling.hasAttribute && nextSibling.hasAttribute('contenteditable')) {
      targetElement = nextSibling;
    }
    
      // If no block after, try the one before
    if (!targetElement) {
      const prevSibling = imageElement.previousSibling;
      if (prevSibling && prevSibling.hasAttribute && prevSibling.hasAttribute('contenteditable')) {
        targetElement = prevSibling;
      }
    }

    // Remove the image block from DOM
    imageElement.remove();

    // Update placeholder visibility
    this.updatePlaceholderVisibility();
    
    // If still no block, create a new empty paragraph in DOM
    if (!targetElement) {
        const { generateBlockId } = require('../post-document');
      const newParagraphEl = document.createElement('p');
      const newParagraphId = generateBlockId(this.getBlockCount());
      newParagraphEl.setAttribute('data-block-id', newParagraphId);
      newParagraphEl.setAttribute('data-block-type', 'paragraph');
      newParagraphEl.contentEditable = 'true';
      newParagraphEl.textContent = '';
      newParagraphEl.appendChild(document.createTextNode('\u200B'));
      editor.appendChild(newParagraphEl);
      targetElement = newParagraphEl;
    }

    // Focus the target block synchronously
        if (targetElement && targetElement.hasAttribute('contenteditable')) {
          const range = document.createRange();
          const selection = window.getSelection();
          
          // Place cursor at the end of the block if it's a paragraph/heading
      const blockType = targetElement.getAttribute('data-block-type');
      if (blockType === 'paragraph' || blockType === 'heading') {
            const textNode = targetElement.firstChild;
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
              const textLength = textNode.textContent.replace(/\u200B/g, '').length;
              range.setStart(textNode, Math.min(textLength, textNode.textContent.length));
              range.setEnd(textNode, Math.min(textLength, textNode.textContent.length));
            } else {
              range.setStart(targetElement, 0);
              range.setEnd(targetElement, 0);
            }
          } else {
            range.setStart(targetElement, 0);
            range.setEnd(targetElement, 0);
          }
          
          selection.removeAllRanges();
          selection.addRange(range);
          targetElement.focus();
        }
  }

  attachEvents() {
    try {
      // ========================================================================
      // FEATURED IMAGE: Drag-and-drop upload handler
      // ========================================================================
      const featuredImageDropzone = document.querySelector('#stack-featured-image-dropzone');
      if (featuredImageDropzone) {
        this.app.browser.addDragAndDropFileUploadToElement(
          'stack-featured-image-dropzone',
          (fileData) => {
            if (!fileData) {
              console.warn('Stack: Failed to read featured image file');
              return;
            }
            
            // Handle multiple files: use only the last one
            // fileData is already base64 data URL from the helper
            if (typeof fileData === 'string' && fileData.startsWith('data:image/')) {
              // Extract base64 data (everything after the comma)
              const base64Data = fileData.split(',')[1];
              this.handleFeaturedImageUpload(base64Data);
            } else {
              console.warn('Stack: Invalid image data format');
            }
          },
          true // click_to_upload
        );
      }

      // Also enable drag-and-drop on preview container (for replacing image)
      const previewContainer = document.querySelector('#stack-featured-image-preview-container');
      if (previewContainer) {
        this.app.browser.addDragAndDropFileUploadToElement(
          'stack-featured-image-preview-container',
          (fileData) => {
            if (fileData && typeof fileData === 'string' && fileData.startsWith('data:image/')) {
              const base64Data = fileData.split(',')[1];
              this.handleFeaturedImageUpload(base64Data);
            }
          },
          true // click_to_upload
        );
      }

      // Admin element (draft-state) - always clickable
      const adminElement = document.querySelector('#stack-draft-state');
      if (adminElement) {
        adminElement.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handlePublishTriggerClick();
        });
        // Ensure element is always clickable
        adminElement.style.pointerEvents = 'auto';
        adminElement.style.cursor = 'pointer';
      }

      // Publish button in sidebar - opens publish settings overlay
      const publishBtn = document.querySelector('#stack-editor-publish-btn');
      if (publishBtn) {
        publishBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handlePublishTriggerClick();
        });
      }
      
      // Title input - update next step button on change
      const titleInput = document.querySelector('#stack-post-title-input');
      if (titleInput) {
        titleInput.addEventListener('input', () => {
          this.updateNextStepButton();
          this.updatePublishTriggerVisibility();
          // Schedule save when title changes
          this.scheduleSerialization();
        });
        
        // Handle Enter and Tab to move to body editor
        titleInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            this.focusBodyEditorAtEnd();
          }
        });
        
        titleInput.addEventListener('blur', () => {
          // Auto-focus body editor when title loses focus (if empty)
          if (!titleInput.value.trim()) {
            setTimeout(() => {
              const editor = document.querySelector('#stack-post-body-editor');
              if (editor) {
                const firstBlock = editor.querySelector('[contenteditable="true"]');
                if (firstBlock) {
                  firstBlock.focus();
                }
              }
            }, 0);
          }
        });
      }

      // Next step button (Preview)
      const nextStepBtn = document.querySelector('#stack-next-step-btn');
      if (nextStepBtn) {
        nextStepBtn.onclick = (e) => {
          e.preventDefault();
          if (!nextStepBtn.disabled && this.mod.previewOverlay) {
            this.mod.previewOverlay.render();
          }
        };
      }

      // Editor keyboard and input handlers
      const editor = document.querySelector('#stack-post-body-editor');
      if (editor) {
        // Handle Enter key
        editor.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            this.handleEnterKey(e);
          } else if (e.key === 'Enter' && e.shiftKey) {
            this.handleShiftEnterKey(e);
          } else if (e.key === 'Backspace') {
            this.handleBackspaceKey(e);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            this.handleArrowKey(e);
          } else if (e.key === 'Delete') {
            this.handleDeleteKey(e);
          }
        });

        // Handle input events
        editor.addEventListener('input', (e) => {
          this.handleEditorInput(e);
        });
        
        // Handle IME composition events to prevent saving during composition
        editor.addEventListener('compositionstart', () => {
          this.isComposing = true;
        });
        
        editor.addEventListener('compositionend', () => {
          this.isComposing = false;
          // Schedule save after composition ends
          this.scheduleSerialization();
        });

        // Handle paste events
        editor.addEventListener('paste', (e) => {
          this.handlePaste(e);
        });

        // Handle drag and drop
        editor.addEventListener('dragover', (e) => {
          this.handleDragOver(e);
        });

        editor.addEventListener('dragleave', (e) => {
          this.handleDragLeave(e);
        });

        editor.addEventListener('drop', (e) => {
          this.handleDrop(e);
        });


        // Handle clicks on image blocks to show/hide caption
        editor.addEventListener('click', (e) => {
          const imageBlock = e.target.closest('figure[data-block-type="image"]');
          if (imageBlock) {
            this.handleImageClick(imageBlock);
          } else {
            // Deselect all images when clicking elsewhere
            this.deselectAllImages();
          }
        });
      }
    } catch (err) {
      console.error('CreatePost attachEvents error:', err);
    }
  }

  /**
   * ========================================================================
   * PUBLISH: Pure DOM Read → Transaction Construction → Emission
   * ========================================================================
   * 
   * PUBLISH-TIME INVARIANT: DOM is the SINGLE source of truth.
   * - Reads title directly from #stack-post-title-input
   * - Reads body directly from #stack-post-body-editor (via serializeDOMToMarkdown)
   * - Does NOT depend on autosave state, cached content, or draft snapshots
   * - Side-effect free: does NOT modify editor DOM or affect future sessions
   * 
   * Publishing consumes the active draft and ends the current session.
   */
  async handlePublish() {
    // ========================================================================
    // [EDITOR-INVARIANT] Log publish begin for validation
    // ========================================================================
    console.debug('[EDITOR-INVARIANT] Publish begin, activeDraftId:', this.activeDraftId);

    // ========================================================================
    // INVARIANT CHECK: Editor must be mounted
    // ========================================================================
    try {
      this.assertEditorMounted('handlePublish');
    } catch (error) {
      console.error('[EDITOR-INVARIANT] Publish failed - editor not mounted:', error);
      alert('Error: Editor not ready. Please refresh and try again.');
      return;
    }

    // ========================================================================
    // INVARIANT CHECK: Session intent must be valid
    // ========================================================================
    try {
      this.assertValidSessionIntent('handlePublish');
    } catch (error) {
      console.error('[EDITOR-INVARIANT] Publish failed - invalid session intent:', error);
      alert('Error: Invalid editor session state. Please refresh and try again.');
      return;
    }

    // ========================================================================
    // PRE-PUBLISH: Clear pending autosave operations (does not affect publish output)
    // ========================================================================
    // Cancel any pending autosave timers to avoid interference
    // This is cleanup only - publish does not depend on autosave state
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }
    if (this.serializeTimeout) {
      clearTimeout(this.serializeTimeout);
      this.serializeTimeout = null;
    }
    this.queuedSave = false;
    
    // ========================================================================
    // PUBLISH SERIALIZATION: Direct DOM read (synchronous, pure)
    // ========================================================================
    // Read directly from live DOM elements - no cache, no draft state, no autosave
    const titleInput = document.querySelector('#stack-post-title-input');
    if (!titleInput) {
      console.error('[EDITOR-INVARIANT] handlePublish() called but #stack-post-title-input not found');
      alert('Error: Editor title input not found. Please refresh and try again.');
      return;
    }
    
      const editor = document.querySelector('#stack-post-body-editor');
    if (!editor) {
      console.error('[EDITOR-INVARIANT] handlePublish() called but #stack-post-body-editor not found');
      alert('Error: Editor body not found. Please refresh and try again.');
      return;
    }

    const title = titleInput.value.trim();
    
    // ========================================================================
    // IMAGE EXTRACTION: Extract embedded images from editor DOM
    // ========================================================================
    const images = [];
    const imageIdMap = new Map(); // Maps img.src -> imageId
    
    try {
      // Walk the editor DOM to find all embedded images
      const imageBlocks = editor.querySelectorAll('figure[data-block-type="image"]');
      
      for (const imageBlock of imageBlocks) {
        const img = imageBlock.querySelector('img');
        if (!img || !img.src) continue;
        
        // Skip if this image src is already processed (deduplication within a post)
        if (imageIdMap.has(img.src)) continue;
        
        // Generate unique imageId
        const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Extract image data
        let imageData = '';
        let mimeType = 'image/png';
        let width = null;
        let height = null;
        
        if (img.src.startsWith('data:image/')) {
          // Extract base64 data from data URL
          const dataUrlParts = img.src.split(',');
          if (dataUrlParts.length === 2) {
            // Extract mime type from data URL
            const mimeMatch = img.src.match(/data:image\/([^;]+)/);
            if (mimeMatch) {
              mimeType = `image/${mimeMatch[1]}`;
            }
            imageData = dataUrlParts[1];
          } else {
            console.error('Stack: Invalid data URL format for image:', img.src.substring(0, 50));
            alert('Error: Invalid image format. Please remove and re-add the image.');
            return;
          }
        } else {
          // External URL - not supported for embedded images (only data URLs)
          console.warn('Stack: Skipping external image URL (not supported for embedded images):', img.src);
          continue;
        }
        
        // Extract dimensions if available
        if (img.naturalWidth && img.naturalHeight) {
          width = img.naturalWidth;
          height = img.naturalHeight;
        } else if (img.width && img.height) {
          width = img.width;
          height = img.height;
        }
        
        // Extract caption/alt text
        const captionEl = imageBlock.querySelector('.stack-image-caption');
        const alt = captionEl ? captionEl.textContent : (img.alt || '');
        
        // Create image object
        const imageObj = {
          id: imageId,
          data: imageData,
          mime: mimeType,
          alt: alt
        };
        
        if (width !== null) imageObj.width = width;
        if (height !== null) imageObj.height = height;
        
        images.push(imageObj);
        imageIdMap.set(img.src, imageId);
      }
    } catch (imageExtractionError) {
      console.error('Stack: Error extracting images from editor:', imageExtractionError);
      alert('Error: Failed to extract images. Please check for malformed images and try again.');
      return; // Do NOT publish partial content
    }
    
    // Serialize DOM to markdown with image references
    let content = '';
    try {
      content = this.serializeDOMToMarkdown(imageIdMap).trim();
    } catch (serializationError) {
      console.error('Stack: Error serializing editor content to markdown:', serializationError);
      alert('Error: Failed to serialize editor content. Please check for malformed content and try again.');
      return; // Do NOT publish partial content
    }
    
    // Validation: Require both title and content
    if (!title) {
      alert('Please enter a title for your post');
      return;
    }

    if (!content) {
      alert('Please enter content for your post');
      return;
    }

    // ========================================================================
    // TRANSACTION CONSTRUCTION: Build from serialized DOM content
    // ========================================================================
    try {
      // Show loading message
      if (this.app.connection) {
        this.app.connection.emit('saito-header-update-message', {
          msg: 'Publishing post...',
          timeout: 0
        });
      }

      // Get featured image from editor state (authoritative source)
      // Featured image is stored in this.featuredImage as base64 data
      let image = '';
      let imageUrl = '';
      
      if (this.featuredImage) {
        image = this.featuredImage; // Base64 data (already extracted, no data: prefix)
      }

      // Create excerpt from content
      const excerpt = content.substring(0, 200).replace(/\n/g, ' ').trim();
      const excerptWithEllipsis = excerpt.length < content.length ? excerpt + '...' : excerpt;

      // BUILD A NEW TRANSACTION from fresh editor state (no stale objects)
      const newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee(this.mod.publicKey);
      
      const data = {
        type: 'stack_post',
        title: title,
        content: content,
        images: images, // Embedded content images array
        tags: [],
        image: this.featuredImage || image, // Featured/teaser image (singular, separate) - use editor state
        imageUrl: imageUrl,
        timestamp: Date.now(),
        subscriptionTier: 'free',
        excerpt: excerptWithEllipsis
      };

      newtx.msg = {
        module: 'Stack',
        request: 'create stack post request',
        data: data
      };

      // SIGN the transaction
      await newtx.sign();

      // Update the local draft entry to "stack:pending" (if draft exists)
      if (this.draftTransaction) {
        await this.app.storage.updateTransaction(this.draftTransaction, {
          field4: 'stack:pending'
        }, 'localhost');
      }

      // Propagate the signed transaction to the network
      await this.app.network.propagateTransaction(newtx);

      // ========================================================================
      // PUBLISH CONSUMES ACTIVE DRAFT: Mark draft as consumed, stop autosaving
      // ========================================================================
      // Draft is consumed by publish - clear references but do NOT delete yet
      // Actual deletion can be deferred (handled by cleanupPendingDrafts)
      // This ends the current session - autosave will stop for this draft
      const consumedDraftId = this.activeDraftId;
      this.draftTransaction = null;
      this.activeDraftId = null; // Stop autosaving to this draft
      
      // ========================================================================
      // INVARIANT CHECK: Verify activeDraftId was cleared (must not be reused)
      // ========================================================================
      if (this.activeDraftId !== null) {
        console.error('[EDITOR-INVARIANT] activeDraftId was not cleared after publish:', this.activeDraftId);
      }
      
      // Set published state (for UI feedback only - reset on next session mount)
      this.isPublished = true;
      this.updatePublishTriggerState();

      // ========================================================================
      // [EDITOR-INVARIANT] Log publish end for validation
      // ========================================================================
      console.debug('[EDITOR-INVARIANT] Publish end, consumed draft:', consumedDraftId, 'activeDraftId cleared:', this.activeDraftId === null);

      // Update status
      if (this.app.connection) {
        this.app.connection.emit('saito-header-update-message', {
          msg: 'Post published',
          timeout: 2000
        });
      }

    } catch (error) {
      // ========================================================================
      // EXPLICIT ERROR HANDLING: Do NOT publish partial content, leave editor intact
      // ========================================================================
      console.error('Stack: Error publishing post:', error);
      
      // Show clear error message to user
      const errorMessage = error.message || 'Unknown error occurred';
      alert(`Failed to publish post: ${errorMessage}\n\nThe editor content has been preserved. Please try again.`);
      
      // Clear any loading indicators
      if (this.app.connection) {
        this.app.connection.emit('saito-header-update-message', {
          msg: 'Error publishing post',
          timeout: 3000
        });
      }
      
      // Editor session remains intact - user can retry without data loss
      // isPublished remains false, autosave continues, draft remains active
    }
  }

  /**
   * Update featured image display above title input
   * Shows/hides the featured image section based on this.featuredImage
   * Manages both dropzone (when no image) and preview (when image exists)
   */
  updateFeaturedImageDisplay() {
    const featuredImageSection = document.querySelector('#stack-featured-image-section');
    const dropzone = document.querySelector('#stack-featured-image-dropzone');
    const previewContainer = document.querySelector('#stack-featured-image-preview-container');
    const featuredImagePreview = document.querySelector('#stack-featured-image-preview');
    const removeBtn = document.querySelector('#stack-featured-image-remove-btn');

    if (!featuredImageSection) {
      return;
    }

    if (this.featuredImage) {
      // Show preview, hide dropzone
      if (dropzone) dropzone.style.display = 'none';
      if (previewContainer) {
        previewContainer.style.display = 'block';
        const dataUrl = `data:image/png;base64,${this.featuredImage}`;
        if (featuredImagePreview) {
          featuredImagePreview.src = dataUrl;
        }
      }

      // Attach remove button handler if not already attached
      if (removeBtn && !removeBtn.dataset.handlerAttached) {
        removeBtn.dataset.handlerAttached = 'true';
        removeBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handleFeaturedImageRemove();
        };
      }
    } else {
      // Show dropzone, hide preview
      if (dropzone) dropzone.style.display = 'block';
      if (previewContainer) previewContainer.style.display = 'none';
      if (featuredImagePreview) featuredImagePreview.src = '';
    }
  }

  /**
   * Handle featured image removal
   */
  handleFeaturedImageRemove() {
    this.featuredImage = null;
    this.updateFeaturedImageDisplay();
    
    // If publish settings overlay is open, update it too
    if (this.mod.publishSettingsOverlay && this.mod.publishSettingsOverlay.postState) {
      this.mod.publishSettingsOverlay.postState.image = null;
      this.mod.publishSettingsOverlay.updateFeaturedImageDropzone(null);
    }
  }
}

module.exports = CreatePost;

