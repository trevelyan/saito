const SaitoOverlay = require('../../../../../lib/saito/ui/saito-overlay/saito-overlay');
const WelcomeBackTemplate = require('./welcome-back.template');

class WelcomeBackOverlay {
  constructor(app, mod) {
    this.app = app;
    this.mod = mod;
    this.overlay = new SaitoOverlay(this.app, this.mod);
  }

  render(posts = [], hasDraft = null) {
    // Check for draft if not provided
    if (hasDraft === null) {
      hasDraft = this.hasDraft();
    }
    
    const html = WelcomeBackTemplate(this.app, this.mod, posts, hasDraft);
    this.overlay.show(html);
    
    setTimeout(() => {
      this.attachEvents(posts, hasDraft);
    }, 25);
  }

  attachEvents(posts, hasDraft) {
    // Continue writing button - load most recent draft
    const continueBtn = document.querySelector('#stack-welcome-continue-btn');
    if (continueBtn) {
      continueBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleContinueWriting();
      });
    }

    // Edit another post button - show post list
    const editAnotherBtn = document.querySelector('#stack-welcome-edit-another-btn');
    if (editAnotherBtn) {
      editAnotherBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleEditAnother(posts);
      });
    }

    // Start fresh button - clear draft and start blank
    const startFreshBtn = document.querySelector('#stack-welcome-start-fresh-btn');
    if (startFreshBtn) {
      startFreshBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleStartFresh();
      });
    }

    // Close overlay
    const closeBtn = document.querySelector('.saito-overlay-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.overlay.hide();
      });
    }

    // Click outside to close
    const overlayBackdrop = document.querySelector('.saito-overlay-backdrop');
    if (overlayBackdrop) {
      overlayBackdrop.addEventListener('click', (e) => {
        if (e.target === overlayBackdrop) {
          this.overlay.hide();
        }
      });
    }
  }

  handleContinueWriting() {
    // Set session flag to prevent immediate re-showing
    sessionStorage.setItem('stack-welcome-overlay-shown', 'true');
    
    // Close overlay - draft will be loaded automatically by initializeDocument
    this.overlay.hide();
    
    // Focus the editor
    setTimeout(() => {
      const editor = document.querySelector('#stack-post-body-editor');
      if (editor) {
        const firstBlock = editor.querySelector('[contenteditable="true"]');
        if (firstBlock) {
          firstBlock.focus();
        }
      }
    }, 100);
  }

  handleEditAnother(posts) {
    // Show post selection overlay
    this.overlay.hide();
    
    // Create a simple post selection overlay
    const postListHtml = this.renderPostList(posts);
    this.overlay.show(postListHtml);
    
    setTimeout(() => {
      this.attachPostListEvents(posts);
    }, 25);
  }

  renderPostList(postRefs) {
    // ========================================================================
    // postRefs from app.options.stack.posts are lightweight: { sig, publicKey, timestamp, lastEdited, status }
    // Try to get titles from cache, otherwise load from archive
    // ========================================================================
    // Sort posts by timestamp (most recent first)
    const sortedPosts = [...postRefs].sort((a, b) => {
      const timeA = a.timestamp || a.lastEdited || 0;
      const timeB = b.timestamp || b.lastEdited || 0;
      return timeB - timeA;
    });

    const postItems = sortedPosts.map((postRef, index) => {
      // Try to get title from cache first
      let title = 'Untitled';
      if (this.mod.transactionCache && this.mod.transactionCache[postRef.sig]) {
        const tx = this.mod.transactionCache[postRef.sig];
        const txmsg = tx.returnMessage();
        if (txmsg && txmsg.data && txmsg.data.title) {
          title = txmsg.data.title;
        }
      }
      
      // If not in cache, use placeholder (will be loaded on click)
      if (title === 'Untitled' && postRef.sig) {
        title = `Post ${postRef.sig.substring(0, 8)}...`;
      }
      
      const date = postRef.timestamp || postRef.lastEdited || Date.now();
      const dateObj = this.app.browser.formatDate(date);
      const dateStr = dateObj ? `${dateObj.month} ${dateObj.day}, ${dateObj.year}` : '';
      
      return `
        <div class="stack-welcome-post-item" data-post-index="${index}">
          <div class="stack-welcome-post-title">${this.app.browser.escapeHTML(title)}</div>
          <div class="stack-welcome-post-date">${dateStr}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="stack-welcome-overlay">
        <div class="stack-welcome-content">
          <div class="stack-welcome-header">
            <h2>Edit another post</h2>
          </div>
          <div class="stack-welcome-post-list">
            ${postItems || '<p class="stack-welcome-empty">No posts found</p>'}
          </div>
          <div class="stack-welcome-actions">
            <button id="stack-welcome-back-btn" class="stack-welcome-back-btn">Back</button>
          </div>
        </div>
      </div>
    `;
  }

  attachPostListEvents(postRefs) {
    // Post item clicks - load full post from archive
    const postItems = document.querySelectorAll('.stack-welcome-post-item');
    postItems.forEach((item, index) => {
      item.addEventListener('click', async (e) => {
        e.preventDefault();
        const postIndex = parseInt(item.getAttribute('data-post-index'), 10);
        const postRef = postRefs[postIndex];
        if (postRef) {
          await this.loadPostIntoEditor(postRef);
        }
      });
    });

    // Back button
    const backBtn = document.querySelector('#stack-welcome-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Re-show the welcome overlay
        this.render(posts, this.hasDraft());
      });
    }

    // Close overlay
    const closeBtn = document.querySelector('.saito-overlay-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.overlay.hide();
      });
    }
  }

  async loadPostIntoEditor(postRef) {
    // ========================================================================
    // Load full post content from archive (app.options only has lightweight reference)
    // ========================================================================
    // postRef from app.options.stack.posts only contains: { sig, publicKey, timestamp, lastEdited, status }
    // Full content must be loaded from archive
    const postSig = postRef.sig;
    let tx = null;
    
    // Try to load from archive
    if (this.mod.loadPost && postSig) {
      try {
        tx = await this.mod.loadPost(postSig, {}, null);
      } catch (error) {
        console.error('Stack: Failed to load post from archive:', error);
      }
    }
    
    if (!tx) {
      console.error('Stack: Post not found in archive:', postSig);
      this.overlay.hide();
      return;
    }

    // Set session flag
    sessionStorage.setItem('stack-welcome-overlay-shown', 'true');
    
    // Close overlay
    this.overlay.hide();

    // Extract post data from transaction
    const txmsg = tx.returnMessage();
    const postData = (txmsg && txmsg.data) || {};

    // Load post data into editor
    if (this.mod.create_post_ui) {
      // Set title
      const titleInput = document.querySelector('#stack-post-title-input');
      if (titleInput && postData.title) {
        titleInput.value = postData.title;
      }

      // Load content into document
      if (postData.content) {
        const { parseMarkdownToDocument } = require('../../post-document');
        this.mod.create_post_ui.document = parseMarkdownToDocument(postData.content);
        this.mod.create_post_ui.renderDocument();
        this.mod.create_post_ui.updatePlaceholderVisibility();
        this.mod.create_post_ui.updatePublishTriggerVisibility();
      } else {
        // If no content, ensure we have an empty document
        const { generateBlockId } = require('../../post-document');
        this.mod.create_post_ui.document = { blocks: [{ type: 'paragraph', id: generateBlockId(0), text: '' }] };
        this.mod.create_post_ui.renderDocument();
        this.mod.create_post_ui.updatePlaceholderVisibility();
      }

      // Set published state (post from archive is published)
      this.mod.create_post_ui.isPublished = true;
      this.mod.create_post_ui.updatePublishTriggerState();

      // Focus editor at end
      setTimeout(() => {
        this.mod.create_post_ui.focusBodyEditorAtEnd();
      }, 100);
    }
  }

  handleStartFresh() {
    // Show soft confirmation
    if (!confirm('This will discard the current draft.')) {
      return;
    }

    // Set session flag
    sessionStorage.setItem('stack-welcome-overlay-shown', 'true');
    
    // Clear draft from localStorage
    try {
      localStorage.removeItem('stack-post-draft');
    } catch (err) {
      console.error('Error clearing draft:', err);
    }

    // Clear editor
    if (this.mod.create_post_ui) {
      const { generateBlockId } = require('../../post-document');
      this.mod.create_post_ui.document = { blocks: [{ type: 'paragraph', id: generateBlockId(0), text: '' }] };
      this.mod.create_post_ui.renderDocument();
      this.mod.create_post_ui.updatePlaceholderVisibility();
      this.mod.create_post_ui.updatePublishTriggerVisibility();
    }

    // Clear title
    const titleInput = document.querySelector('#stack-post-title-input');
    if (titleInput) {
      titleInput.value = '';
    }

    // Close overlay
    this.overlay.hide();

    // Focus editor
    setTimeout(() => {
      const editor = document.querySelector('#stack-post-body-editor');
      if (editor) {
        const firstBlock = editor.querySelector('[contenteditable="true"]');
        if (firstBlock) {
          firstBlock.focus();
        }
      }
    }, 100);
  }

  hasDraft() {
    try {
      const draft = localStorage.getItem('stack-post-draft');
      return draft && draft.trim().length > 0;
    } catch (err) {
      return false;
    }
  }
}

module.exports = WelcomeBackOverlay;

