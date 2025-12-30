const SaitoOverlay = require('../../../../../lib/saito/ui/saito-overlay/saito-overlay');
const PublishSettingsTemplate = require('./publish-settings.template');

class PublishSettingsOverlay {
  constructor(app, mod) {
    this.app = app;
    this.mod = mod;
    this.overlay = new SaitoOverlay(this.app, this.mod);
    this.postState = {
      published: false,
      accessLevel: 'public', // 'public', 'private', 'subscription'
      description: '',
      image: null,
      imageUrl: null,
      customCSS: ''
    };
  }

  render(postData = {}) {
    // Merge provided post data with current state
    this.postState = {
      ...this.postState,
      ...postData
    };

    // If editor has featured image, use it (authoritative source)
    if (this.mod.create_post_ui && this.mod.create_post_ui.featuredImage) {
      this.postState.image = this.mod.create_post_ui.featuredImage;
    }

    const html = PublishSettingsTemplate(this.app, this.mod, this.postState);
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
        this.overlay.hide();
      });
    }

    // Access level checkbox cards (only one can be active)
    const accessCards = document.querySelectorAll('.stack-publish-access-card');
    const accessCheckboxes = document.querySelectorAll('.stack-publish-access-checkbox');
    
    accessCards.forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't trigger if clicking directly on the checkbox
        if (e.target.type === 'checkbox') return;
        
        const checkbox = card.querySelector('.stack-publish-access-checkbox');
        const accessValue = card.getAttribute('data-access');
        
        // Uncheck all others
        accessCheckboxes.forEach(cb => {
          if (cb !== checkbox) {
            cb.checked = false;
            cb.closest('.stack-publish-access-card')?.classList.remove('stack-publish-access-card-active');
          }
        });
        
        // Toggle this one
        checkbox.checked = true;
        card.classList.add('stack-publish-access-card-active');
        
        // Only allow selection of public or private (subscription is disabled)
        if (accessValue === 'subscription') {
          // Subscription is disabled - do not change state
          checkbox.checked = false;
          card.classList.remove('stack-publish-access-card-active');
          return;
        }
        
        this.setAccessLevel(accessValue);
      });
    });

    // Checkbox change handlers (for direct checkbox clicks)
    accessCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const card = checkbox.closest('.stack-publish-access-card');
        const accessValue = card?.getAttribute('data-access');
        
        if (checkbox.checked) {
          // Prevent selection of disabled subscription option
          if (accessValue === 'subscription') {
            checkbox.checked = false;
            return;
          }
          
          // Uncheck all others
          accessCheckboxes.forEach(cb => {
            if (cb !== checkbox) {
              cb.checked = false;
              cb.closest('.stack-publish-access-card')?.classList.remove('stack-publish-access-card-active');
            }
          });
          card?.classList.add('stack-publish-access-card-active');
          
          this.setAccessLevel(accessValue);
        } else {
          // Prevent unchecking - at least one must be selected
          checkbox.checked = true;
        }
      });
    });

    // Delete draft button
    const deleteDraftBtn = document.querySelector('#stack-publish-delete-draft-btn');
    if (deleteDraftBtn) {
      deleteDraftBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleDeleteDraft();
      });
    }

    // Primary action button (Publish)
    const primaryBtn = document.querySelector('#stack-publish-primary-btn');
    if (primaryBtn) {
      primaryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handlePublish();
      });
    }
  }

  handleDeleteDraft() {
    if (confirm('Are you sure you want to delete this draft? This action cannot be undone.')) {
      // Delete the draft transaction from the archive
      if (this.mod.create_post_ui && this.mod.create_post_ui.draftTransaction) {
        this.app.storage.deleteTransaction(this.mod.create_post_ui.draftTransaction, null, 'localhost')
          .then(() => {
            this.mod.create_post_ui.draftTransaction = null; // Clear reference
            
            // Clear the editor
            const editor = document.querySelector('#stack-post-body-editor');
            if (editor && this.mod.create_post_ui) {
              const { parseMarkdownToDocument, renderDocument } = require('../../post-document');
              const emptyDocument = parseMarkdownToDocument('');
              renderDocument(emptyDocument, editor, { contentEditable: true });
              this.mod.create_post_ui.updatePlaceholderVisibility();
              this.mod.create_post_ui.updatePublishTriggerVisibility();
            }
            
            // Clear title
            const titleInput = document.querySelector('#stack-post-title-input');
            if (titleInput) {
              titleInput.value = '';
            }
            
            // Hide overlay and navigate back to front page
            this.overlay.hide();
            
            // Navigate back to front page (main splash page)
            if (this.mod.main) {
              setTimeout(() => {
                this.mod.main.render();
              }, 100); // Small delay for smooth transition
            }
            
            siteMessage('Draft deleted', 1500);
          })
          .catch(error => {
            console.error('Error deleting draft transaction:', error);
            alert('Failed to delete draft. Please try again.');
          });
      } else {
        // If no draftTransaction, just clear editor and navigate back
        const editor = document.querySelector('#stack-post-body-editor');
        if (editor && this.mod.create_post_ui) {
          const { parseMarkdownToDocument, renderDocument } = require('../../post-document');
          const emptyDocument = parseMarkdownToDocument('');
          renderDocument(emptyDocument, editor, { contentEditable: true });
          this.mod.create_post_ui.updatePlaceholderVisibility();
          this.mod.create_post_ui.updatePublishTriggerVisibility();
        }
        
        const titleInput = document.querySelector('#stack-post-title-input');
        if (titleInput) {
          titleInput.value = '';
        }
        
        this.overlay.hide();
        
        // Navigate back to front page
        if (this.mod.main) {
          setTimeout(() => {
            this.mod.main.render();
          }, 100);
        }
        
        siteMessage('Draft deleted', 1500);
      }
    }
  }

  setAccessLevel(level) {
    // Only allow 'public' or 'private' (subscription is disabled)
    if (level === 'subscription') {
      console.warn('Stack: Subscription access mode is not yet available');
      return;
    }
    
    this.postState.accessLevel = level; // 'public' or 'private'
    
    // Update checkbox card states
    const accessCards = document.querySelectorAll('.stack-publish-access-card');
    
    accessCards.forEach(card => {
      const cardValue = card.getAttribute('data-access');
      const checkbox = card.querySelector('.stack-publish-access-checkbox');
      
      if (cardValue === level) {
        checkbox.checked = true;
        card.classList.add('stack-publish-access-card-active');
      } else {
        checkbox.checked = false;
        card.classList.remove('stack-publish-access-card-active');
      }
    });
  }

  async handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      let imageDataUrl = dataUrl;
      if (this.app.browser && this.app.browser.resizeImg) {
        try {
          imageDataUrl = await this.app.browser.resizeImg(dataUrl);
        } catch (err) {
          console.warn('Image resize failed, using original:', err);
        }
      }

      this.postState.image = imageDataUrl.split(',')[1]; // Base64 data
      this.postState.imageUrl = null;

      // Update preview
      const previewImg = document.querySelector('#stack-publish-image-preview');
      if (previewImg) {
        previewImg.src = imageDataUrl;
        previewImg.style.display = 'block';
      }
    } catch (err) {
      console.error('Error uploading image:', err);
    }
  }

  handleUnpublish() {
    if (confirm('Are you sure you want to unpublish this post?')) {
      this.postState.published = false;
      this.overlay.hide();
      // Update publish trigger state
      if (this.mod.create_post_ui) {
        this.mod.create_post_ui.isPublished = false;
        this.mod.create_post_ui.updatePublishTriggerState();
      }
      siteMessage('Post unpublished', 1500);
    }
  }


  async handlePublish() {
    const title = document.querySelector('#stack-post-title-input')?.value || '';
    // Use DOM-based serialization (DOM is single source of truth)
    const content = this.mod.create_post_ui ? this.mod.create_post_ui.serializeDOMToMarkdown() : '';

    if (!title.trim()) {
      alert('Please enter a title for your post');
      return;
    }

    if (!content.trim()) {
      alert('Please enter content for your post');
      return;
    }

    try {
      this.app.connection.emit('saito-header-update-message', { msg: 'Publishing post...' });
      
      // Get featured image from editor state (authoritative source)
      const featuredImage = this.mod.create_post_ui?.featuredImage || this.postState.image || '';
      
      await this.mod.createStackPostTransaction({
        title,
        content,
        image: featuredImage, // Featured/teaser image (singular)
        imageUrl: this.postState.imageUrl,
        tags: [],
        timestamp: Date.now(),
        subscriptionTier: this.postState.accessLevel === 'public' ? 'free' : 'paid',
        excerpt: this.postState.description || content.substring(0, 200).replace(/\n/g, ' ').trim(),
        accessLevel: this.postState.accessLevel // 'public' or 'private'
      }, () => {
        this.postState.published = true;
        this.app.connection.emit('saito-header-update-message', { msg: '' });
        siteMessage('Stack post published', 1500);
        this.overlay.hide();
        
        // Update publish trigger state
        if (this.mod.create_post_ui) {
          this.mod.create_post_ui.isPublished = true;
          this.mod.create_post_ui.updatePublishTriggerState();
        }

        // Post will be saved to app.options.stack.posts in receiveStackPostTransaction
      });
    } catch (error) {
      console.error('Error publishing post:', error);
      this.app.connection.emit('saito-header-update-message', {
        msg: 'Error publishing post',
        timeout: 2000
      });
      alert('Failed to publish post. Please try again.');
    }
  }

  handleViewPreview() {
    // Close this overlay and open preview overlay
    this.overlay.hide();
    if (this.mod.previewOverlay) {
      this.mod.previewOverlay.render();
    }
  }
}

module.exports = PublishSettingsOverlay;

