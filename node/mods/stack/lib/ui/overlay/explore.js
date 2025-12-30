const ExploreTemplate = require('./explore.template');
const SaitoOverlay = require('../../../../../lib/saito/ui/saito-overlay/saito-overlay');
const ViewPost = require('../view-post');
const SaitoUser = require('../../../../../lib/saito/ui/saito-user/saito-user');
const PostTeaser = require('../post-teaser');

class ExploreOverlay {
  constructor(app, mod) {
    this.app = app;
    this.mod = mod;
    this.overlay = new SaitoOverlay(this.app, this.mod);
    this.posts = [];
    this.isLoading = false;
    this.currentFilter = 'all';
    this.targetPublicKey = null; // For URL-based routing: publicKey to show posts for
  }

  async render() {
    // ========================================================================
    // INVARIANT 4: Unmount before navigating to explore (navigation path: editor → explore)
    // ========================================================================
    if (this.mod.create_post_ui && typeof this.mod.create_post_ui.onEditorUnmount === 'function') {
      this.mod.create_post_ui.onEditorUnmount();
    }

    // Show loading state initially
    this.isLoading = true;
    this.posts = [];
    
    const html = ExploreTemplate(this.app, this.mod, this.posts, this.isLoading);
    this.overlay.show(html);
    
    setTimeout(() => {
      this.attachEvents();
      this.updateHelpNoteVisibility();
      // Load posts after attaching events (skip if URL-based routing already loaded posts)
      if (!(this.targetPublicKey && this.currentFilter === 'creator')) {
        this.loadPostsForFilter(this.currentFilter);
      }
    }, 25);
  }

  updateHelpNoteVisibility() {
    // Count subscription items
    const subscriptionItems = document.querySelectorAll('.stack-explore-subscription-item');
    const helpNote = document.querySelector('.stack-explore-help-note');
    
    if (helpNote && subscriptionItems.length > 2) {
      // Hide help note if more than 2 subscriptions
      helpNote.classList.add('hide-help');
    } else if (helpNote) {
      // Show help note if 2 or fewer subscriptions
      helpNote.classList.remove('hide-help');
    }
  }

  updateAuthorHeader() {
    const authorHeader = document.querySelector('#stack-explore-author-header');
    if (!authorHeader) return;

    // URL-based routing: if targetPublicKey is set, use it
    if (this.targetPublicKey) {
      // Preserve subscribe button container structure
      const subscribeContainer = document.querySelector('#stack-explore-subscribe-button-container');
      const subscribeButtonHtml = subscribeContainer ? subscribeContainer.outerHTML : '';
      
      // Clear and rebuild header with subscribe button container
      authorHeader.innerHTML = subscribeButtonHtml || '';

      // Create container for author identity
      const authorIdentityContainer = document.createElement('div');
      authorIdentityContainer.id = 'stack-explore-author-identity';
      if (authorHeader.firstChild) {
        authorHeader.insertBefore(authorIdentityContainer, authorHeader.firstChild);
      } else {
        authorHeader.appendChild(authorIdentityContainer);
      }

      // Render author identity
      const saitoUser = new SaitoUser(
        this.app,
        this.mod,
        '#stack-explore-author-identity',
        this.targetPublicKey,
        'Posts by this author', // Use notice parameter for description
        '' // fourthelem
      );
      saitoUser.render();

      // Show/hide subscribe button based on subscription status
      const isSubscribed = this.mod.isSubscribed(this.targetPublicKey);
      const subscribeBtnContainer = document.querySelector('#stack-explore-subscribe-button-container');
      if (subscribeBtnContainer) {
        subscribeBtnContainer.style.display = isSubscribed ? 'none' : 'block';
      }
      return;
    }

    // Clear existing content for non-URL routing
    authorHeader.innerHTML = '';

    // Find the currently active subscription item
    const activeItem = document.querySelector('.stack-explore-subscription-item.active');
    if (!activeItem) return;

    const filter = activeItem.getAttribute('data-filter');
    const itemText = activeItem.querySelector('span')?.textContent || '';

    let publicKey = '';
    let description = '';

    // Handle different subscription types
    if (filter === 'all' || itemText === 'Saito Official') {
      // For Saito Official, use a default public key or special handling
      // In a real implementation, this would use the actual Saito Official public key
      publicKey = this.mod.publicKey || ''; // Placeholder - would be actual Saito Official key
      description = 'Posts by this author';
      
      if (!publicKey) {
        // If no key available, hide the header
        return;
      }
    } else if (filter === 'my-posts') {
      // For "My Posts", show the current user's identity
      publicKey = this.app.wallet?.returnPublicKey() || this.mod.publicKey || '';
      description = 'Your posts';
      
      if (!publicKey) {
        // If no user key available, hide the header
        return;
      }
    } else {
      // For other subscriptions, would use the subscription's public key
      // For now, hide if not a recognized filter
      return;
    }

    // Use SaitoUser component to render identity
    const saitoUser = new SaitoUser(
      this.app,
      this.mod,
      '#stack-explore-author-header',
      publicKey,
      description, // Use notice parameter for description
      '' // fourthelem
    );
    saitoUser.render();
  }

  /**
   * Gets post signatures for the given filter.
   * Extracts signatures from the module's postsCache.
   * Returns empty array if no posts available.
   */
  getKeysForFilter(filter) {
    if (!this.mod.postsCache) {
      return [];
    }

    // URL-based routing: if targetPublicKey is set, posts are already loaded directly
    // For creator view, posts array is already populated by handleCreatorView
    if (this.targetPublicKey && filter === 'creator') {
      // Posts are already loaded in handleCreatorView, return their signatures
      return this.posts.map(post => post.signature).filter(sig => sig);
    }

    if (filter === 'my-posts') {
      // Get current user's public key
      const userPublicKey = this.app.wallet?.returnPublicKey() || this.mod.publicKey || '';
      if (!userPublicKey) {
        return [];
      }
      
      // Get posts by this author from cache
      const authorPosts = this.mod.postsCache.byAuthor?.get(userPublicKey) || [];
      return authorPosts.map(post => post.sig).filter(sig => sig);
    } else if (filter === 'all') {
      // Get all posts from cache
      const allPosts = this.mod.postsCache.allPosts || [];
      return allPosts.map(post => post.sig).filter(sig => sig);
    }

    return [];
  }

  /**
   * Loads posts for the given filter using Stack middleware.
   * Shows loading state, then populated or empty state.
   */
  async loadPostsForFilter(filter) {
    this.currentFilter = filter;
    this.isLoading = true;
    this.posts = [];
    
    // Update UI to show loading state
    this.updatePostsGrid();
    
    // Get post signatures for this filter
    const signatures = this.getKeysForFilter(filter);
    
    if (signatures.length === 0) {
      // No signatures available - show empty state
      this.isLoading = false;
      this.updatePostsGrid();
      return;
    }
    
    // Load posts using Stack middleware
    // This will check cache → peers → archive
    this.mod.loadPosts(signatures, 0, {}, (loadedPosts) => {
      // Callback receives array of Transaction objects (or empty array)
      this.posts = loadedPosts || [];
      this.isLoading = false;
      this.updatePostsGrid();
    });
  }

  /**
   * Updates the posts grid with current state (loading, empty, or populated).
   */
  updatePostsGrid() {
    const grid = document.querySelector('#stack-explore-posts-grid');
    if (!grid) return;

    if (this.isLoading) {
      // Show loading spinner
      grid.innerHTML = `
        <div class="stack-explore-loading" style="display: flex; justify-content: center; align-items: center; min-height: 200px; padding: 4rem 2rem;">
          <div style="text-align: center;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 3rem; color: var(--saito-font-color-light); margin-bottom: 1rem;"></i>
            <p style="color: var(--saito-font-color-light); font-size: 1.6rem;">Loading posts...</p>
          </div>
        </div>
      `;
    } else if (this.posts.length > 0) {
      // Show populated posts - use PostTeaser UI component
      const teaserHtml = this.posts.map(transaction => {
        const teaser = new PostTeaser(this.app, this.mod, '', transaction);
        return teaser.render(); // Returns HTML string for batch rendering
      }).join('');
      
      grid.innerHTML = teaserHtml;
      // Re-attach click handlers for new posts
      this.attachPostClickHandlers();
    } else {
      // Show empty state
      grid.innerHTML = `
        <div class="stack-explore-empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; padding: 4rem 2rem; text-align: center;">
          <i class="fa-solid fa-newspaper" style="font-size: 4rem; color: var(--saito-font-color-light); opacity: 0.5; margin-bottom: 2rem;"></i>
          <h3 style="font-size: 2rem; font-weight: 600; color: var(--saito-font-color); margin: 0 0 1rem 0;">No posts available</h3>
          <p style="font-size: 1.6rem; color: var(--saito-font-color-light); margin: 0; max-width: 500px; line-height: 1.6;">
            No posts are visible at this time. This may be because no posts have been published yet, or you may need to subscribe to see content from this creator.
          </p>
        </div>
      `;
    }
  }

  /**
   * Attaches click handlers to post teasers.
   * Each teaser should load ViewPost with its transaction.
   * Resolves transactions from cache using signature.
   */
  attachPostClickHandlers() {
    const teasers = document.querySelectorAll('.stack-post-teaser');
    teasers.forEach(teaser => {
      // Get transaction signature from DOM (preferred) or fallback to post-id
      const txSignature = teaser.getAttribute('data-tx-signature') || teaser.getAttribute('data-post-id');
      if (!txSignature) return;

      // Remove existing click handlers to avoid duplicates
      const newTeaser = teaser.cloneNode(true);
      teaser.parentNode.replaceChild(newTeaser, teaser);

      // Attach click handler
      newTeaser.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Close the explore overlay
        this.overlay.hide();
        
        // Resolve transaction from cache
        // First try this.posts (already loaded)
        let tx = this.posts.find(p => p.signature === txSignature) || null;
        
        // If not found, try Stack module cache
        if (!tx && this.mod.transactionCache && this.mod.transactionCache[txSignature]) {
          tx = this.mod.transactionCache[txSignature];
        }
        
        // If still not found, try loading via middleware (cache → localhost → peers)
        if (!tx && this.mod.loadPost) {
          try {
            tx = await this.mod.loadPost(txSignature, {}, null);
          } catch (error) {
            console.debug('Stack: Failed to load transaction:', error);
          }
        }
        
        // Load ViewPost with transaction (or show error if not found)
        this.loadViewPost(tx, txSignature);
      };
    });
  }

  /**
   * Loads ViewPost into the main saito-container.
   * Handles missing transactions gracefully with error message.
   * 
   * @param {Transaction|null} tx - The transaction to render, or null if not found
   * @param {string} txSignature - The transaction signature (for error messages)
   */
  loadViewPost(tx = null, txSignature = null) {
    // ========================================================================
    // INVARIANT 4: Unmount before navigating to viewer (navigation path: explore → viewer)
    // ========================================================================
    if (this.mod.create_post_ui && typeof this.mod.create_post_ui.onEditorUnmount === 'function') {
      this.mod.create_post_ui.onEditorUnmount();
    }

    const container = document.querySelector('.saito-container');
    if (!container) return;

    // Reset scroll position immediately
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (container.scrollTop !== undefined) {
      container.scrollTop = 0;
    }

    // Store current opacity if already set
    const currentOpacity = container.style.opacity || '1';

    // Fade out existing content
    container.style.transition = 'opacity 200ms ease-out';
    container.style.opacity = '0';

    // After fade out, replace content and fade in
    setTimeout(() => {
      // Clear container
      container.innerHTML = '';

      // If transaction is missing, show error message
      if (!tx) {
        const errorHtml = `
          <div class="stack-view-post-error" style="padding: 4rem 2rem; text-align: center; max-width: 600px; margin: 0 auto;">
            <i class="fa-solid fa-exclamation-circle" style="font-size: 4rem; color: var(--saito-font-color-light); opacity: 0.5; margin-bottom: 2rem;"></i>
            <h2 style="font-size: 2.4rem; font-weight: 600; color: var(--saito-font-color); margin: 0 0 1.5rem 0;">Post Not Available</h2>
            <p style="font-size: 1.8rem; color: var(--saito-font-color-light); margin: 0; line-height: 1.6;">
              This post could not be loaded or is no longer available.
            </p>
            ${txSignature ? `
              <p style="font-size: 1.4rem; color: var(--saito-font-color-light); margin: 1.5rem 0 0 0; opacity: 0.7; font-family: monospace; word-break: break-all;">
                ${txSignature.substring(0, 32)}...
              </p>
            ` : ''}
          </div>
        `;
        container.innerHTML = errorHtml;
      } else {
        // Create and render ViewPost with the transaction
        // ViewPost renders solely from the provided Transaction
        const viewPost = new ViewPost(this.app, this.mod, '.saito-container', tx);
        viewPost.render(tx);
      }

      // Fade in new content
      requestAnimationFrame(() => {
        container.style.transition = 'opacity 200ms ease-in';
        container.style.opacity = '0';

        // Trigger reflow, then fade in
        void container.offsetHeight;

        requestAnimationFrame(() => {
          container.style.opacity = '1';

          // Reset scroll position after content is visible
          setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'instant' });
            if (container.scrollTop !== undefined) {
              container.scrollTop = 0;
            }
            // Clean up inline styles after transition completes
            setTimeout(() => {
              container.style.transition = '';
              container.style.opacity = '';
            }, 200);
          }, 50);
        });
      });
    }, 200);
  }

  attachEvents() {
    try {
      // Update author header on initial load
      this.updateAuthorHeader();
      
      // Add subscription button ("+" icon) in sidebar header
      const addSubscriptionBtn = document.querySelector('#stack-explore-add-subscription-btn');
      if (addSubscriptionBtn) {
        addSubscriptionBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handleAddSubscription();
        };
      }

      // Subscribe button (for URL-based creator view)
      const subscribeBtn = document.querySelector('#stack-explore-subscribe-btn');
      if (subscribeBtn) {
        subscribeBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handleSubscribeToCreator();
        };
      }
      
      // Subscription/Identity list items
      const subscriptionItems = document.querySelectorAll('.stack-explore-subscription-item');
      subscriptionItems.forEach(item => {
        item.onclick = (e) => {
          e.preventDefault();
          // Remove active class from all items
          subscriptionItems.forEach(i => i.classList.remove('active'));
          // Add active class to clicked item
          item.classList.add('active');
          const filter = item.getAttribute('data-filter');
          // Update author header based on selection
          this.updateAuthorHeader();
          // Load posts for the selected filter
          this.loadPostsForFilter(filter);
        };
      });

      // Post teaser clicks are now handled by attachPostClickHandlers()
      // This is called after posts are loaded
      this.attachPostClickHandlers();
    } catch (err) {
      console.error('Explore overlay attachEvents error:', err);
    }
  }

  /**
   * Handle manual subscription addition via "+" icon
   * Opens a modal/overlay to enter username or publicKey
   */
  handleAddSubscription() {
    const promptText = prompt('Enter Saito username or public key:');
    if (!promptText || !promptText.trim()) {
      return; // User cancelled or entered empty
    }

    const input = promptText.trim();
    this.resolveAndSubscribe(input);
  }

  /**
   * Resolve username/publicKey and add subscription
   * @param {string} input - Username or publicKey
   */
  async resolveAndSubscribe(input) {
    try {
      let publicKey = input;

      // Check if input is a valid publicKey
      if (!this.app.wallet.isValidPublicKey(input)) {
        // Try to resolve username to publicKey via keychain
        const keyResponse = this.app.connection.respondTo('saito-return-key');
        if (keyResponse && keyResponse.returnKey) {
          const keyData = keyResponse.returnKey({ identifier: input });
          if (keyData && keyData.publicKey) {
            publicKey = keyData.publicKey;
          } else {
            alert('Unable to find user with that username or public key. Please check and try again.');
            return;
          }
        } else {
          alert('Unable to resolve username. Please enter a valid public key.');
          return;
        }
      }

      // Validate publicKey
      if (!this.app.wallet.isValidPublicKey(publicKey)) {
        alert('Invalid public key. Please check and try again.');
        return;
      }

      // Add subscription
      const added = this.mod.addSubscription(publicKey);
      if (added) {
        // Refresh the overlay to show new subscription
        this.mod.exploreOverlay.render();
      } else {
        alert('Already subscribed to this creator.');
      }
    } catch (error) {
      console.error('Stack: Error adding subscription:', error);
      alert('Error adding subscription. Please try again.');
    }
  }

  /**
   * Handle contextual subscription (when viewing creator via URL)
   * Adds the targetPublicKey to subscriptions
   */
  handleSubscribeToCreator() {
    if (!this.targetPublicKey) {
      return;
    }

    const added = this.mod.addSubscription(this.targetPublicKey);
    if (added) {
      // Hide subscribe button and update UI
      const subscribeContainer = document.querySelector('#stack-explore-subscribe-button-container');
      if (subscribeContainer) {
        subscribeContainer.style.display = 'none';
      }
      
      // Show success message
      if (this.app.connection && this.app.connection.emit) {
        this.app.connection.emit('saito-header-update-message', {
          msg: 'Subscribed!',
          timeout: 2000
        });
      }
    }
  }
}

module.exports = ExploreOverlay;

