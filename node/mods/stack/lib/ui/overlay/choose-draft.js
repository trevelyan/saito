const SaitoOverlay = require('../../../../../lib/saito/ui/saito-overlay/saito-overlay');
const ChooseDraftTemplate = require('./choose-draft.template');

class ChooseDraftOverlay {
  constructor(app, mod) {
    this.app = app;
    this.mod = mod;
    this.overlay = new SaitoOverlay(this.app, this.mod);
    // Disable default backdrop close behavior so we can handle it custom
    this.overlay.clickBackdropToClose = false;
  }

  async render(skipDiscovery = false) {
    // ========================================================================
    // DISCOVER DRAFTS: Only if not explicitly skipped (e.g., after deletion)
    // ========================================================================
    // When skipDiscovery is true, we trust that this.mod.drafts is already
    // up to date (e.g., after deleteDraft() which already called refreshDrafts())
    // This prevents race conditions where discoverDrafts() might re-query
    // the archive before deletion has fully propagated
    if (!skipDiscovery && this.mod.discoverDrafts) {
      await this.mod.discoverDrafts();
    }

    // ========================================================================
    // [DRAFT-CHECK] Log overlay render decision
    // ========================================================================
    console.log('[DRAFT-CHECK] ChooseDraftOverlay.render() called, skipDiscovery=' + skipDiscovery);
    
    // Double-check that valid drafts exist (defensive check)
    const hasValidDrafts = this.mod.hasValidDrafts && this.mod.hasValidDrafts();
    if (!hasValidDrafts) {
      console.log('[DRAFT-CHECK] Overlay render blocked - no valid drafts exist (defensive check)');
      // Hide overlay if already shown
      this.overlay.hide();
      return;
    }

    // ========================================================================
    // RENDER FROM IN-MEMORY DRAFT LIST (single source of truth)
    // ========================================================================
    // Always use this.mod.getDrafts() which returns this.mod.drafts
    // This ensures we're rendering from the same list that was mutated on delete
    const drafts = this.mod.getDrafts();
    const draftCount = drafts ? drafts.length : 0;
    console.log('[DRAFT-CHECK] Rendering overlay with draftCount=' + draftCount);
    
    const html = ChooseDraftTemplate(this.app, this.mod, drafts, draftCount);
    this.overlay.show(html);
    
    setTimeout(() => {
      this.attachEvents();
    }, 25);
  }

  attachEvents() {
    // Close overlay (click outside or close button)
    const overlayCloseBtn = document.querySelector('.saito-overlay-close');
    if (overlayCloseBtn) {
      overlayCloseBtn.addEventListener('click', () => {
        this.handleDefaultDraft();
      });
    }

    // Click outside overlay (on backdrop) - handle custom behavior
    // Wait a bit for overlay to be fully rendered to get the correct backdrop element
    setTimeout(() => {
      const backdrop = document.querySelector(`#saito-overlay-backdrop${this.overlay.ordinal}`);
      if (backdrop) {
        backdrop.addEventListener('click', (e) => {
          // Only handle if clicking directly on backdrop, not children
          if (e.target === backdrop) {
            this.handleDefaultDraft();
          }
        });
      }
    }, 50);

    // Draft row click handlers (up to 3 drafts)
    const draftRows = document.querySelectorAll('.stack-choose-draft-row[data-draft-id]');
    draftRows.forEach(row => {
      const draftId = row.getAttribute('data-draft-id');
      if (draftId) {
        row.addEventListener('click', async (e) => {
          // Don't select if clicking on delete button
          if (e.target.closest('.stack-choose-draft-row-delete')) {
            return;
          }
          
          const intent = { mode: 'select', draftId: draftId };
          this.overlay.hide();
          if (this.mod.create_post_ui) {
            await this.mod.create_post_ui.initializeDocument(intent);
          }
        });
      }
    });

    // Delete icon click handlers (stop propagation to prevent row selection)
    const deleteIcons = document.querySelectorAll('.stack-choose-draft-row-delete');
    deleteIcons.forEach(icon => {
      const draftId = icon.getAttribute('data-draft-id');
      if (draftId) {
        icon.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent row selection
          this.handleDraftDelete(draftId);
        });
      }
    });

    // Create New Post row click handler
    const createNewRow = document.querySelector('#stack-choose-draft-create-new');
    if (createNewRow) {
      createNewRow.addEventListener('click', () => {
        this.handleCreateNew();
      });
    }
  }

  /**
   * Handle selecting a draft to edit
   * Returns session intent object to initializeDocument()
   */
  async handleDraftSelect(draftId) {
    // Return intent and re-initialize editor with it
    const intent = { mode: 'select', draftId: draftId };
    this.overlay.hide();
    
    if (this.mod.create_post_ui) {
      await this.mod.create_post_ui.initializeDocument(intent);
    }
  }

  /**
   * Handle default action (resume most recent draft)
   */
  async handleDefaultDraft() {
    const drafts = this.mod.getDrafts();
    if (drafts && drafts.length > 0) {
      const mostRecent = drafts[0];
      const intent = { mode: 'resume', draftId: mostRecent.id };
      this.overlay.hide();
      
      if (this.mod.create_post_ui) {
        await this.mod.create_post_ui.initializeDocument(intent);
      }
    } else {
      // No drafts, create new
      this.handleCreateNew();
    }
  }

  /**
   * Handle creating a new document
   * Returns session intent object to initializeDocument()
   */
  handleCreateNew() {
    const intent = { mode: 'new' };
    this.overlay.hide();
    
    if (this.mod.create_post_ui) {
      this.mod.create_post_ui.initializeDocument(intent);
    }
  }


  /**
   * Handle deleting a draft
   * Calls stack.js to delete the draft (archive + in-memory list)
   * Shows confirmation alert before deletion
   * After deletion: rediscover drafts and re-render overlay
   */
  async handleDraftDelete(draftId) {
    if (!draftId) {
      return;
    }

    // Show confirmation alert
    if (!confirm('Are you sure you want to delete this draft?')) {
      return;
    }

    // ========================================================================
    // DELETE DRAFT: This updates both archive and in-memory this.mod.drafts
    // ========================================================================
    // deleteDraft() already calls refreshDrafts() which updates this.mod.drafts
    // No need to call discoverDrafts() again - deleteDraft() handles it
    const deleted = await this.mod.deleteDraft && this.mod.deleteDraft(draftId);
    
    if (!deleted) {
      console.error('Stack: Failed to delete draft');
      return;
    }

    // ========================================================================
    // FORCE OVERLAY STATE UPDATE AFTER DELETE
    // ========================================================================
    // deleteDraft() has already:
    // 1. Deleted from archive
    // 2. Removed from this.mod.drafts immediately
    // 3. Called refreshDrafts() which updated this.mod.drafts from archive
    // 
    // We skip discoverDrafts() in render() to prevent race conditions where
    // the archive query might still see the old draft before deletion propagates.
    // We trust that this.mod.drafts is already correct.
    // 
    // This ensures the deleted draft disappears immediately and "Create New Post"
    // appears if draftCount < 3
    await this.render(true); // skipDiscovery = true
  }
}

module.exports = ChooseDraftOverlay;

