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

  async render() {
    // Ensure drafts are discovered before rendering
    if (this.mod.discoverDrafts) {
      await this.mod.discoverDrafts();
    }

    const drafts = this.mod.getDrafts();
    const draftCount = drafts ? drafts.length : 0;
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

    // Delete draft through stack.js (handles archive + in-memory list update)
    const deleted = await this.mod.deleteDraft && this.mod.deleteDraft(draftId);
    
    if (!deleted) {
      console.error('Stack: Failed to delete draft');
      return;
    }

    // ========================================================================
    // INVARIANT: After deletion, rediscover drafts to get authoritative count
    // ========================================================================
    if (this.mod.discoverDrafts) {
      await this.mod.discoverDrafts();
    }

    // Re-render overlay with updated draft list (CREATE NEW POST will appear if count < 3)
    this.render();
  }
}

module.exports = ChooseDraftOverlay;

