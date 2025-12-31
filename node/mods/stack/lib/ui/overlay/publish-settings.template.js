/**
 * Publish Settings Overlay Template
 * 
 * Complete rewrite - three-card layout for the moment of publishing.
 */
module.exports = (app, mod, postState = {}) => {
  const titleInput = document.querySelector('#stack-post-title-input');
  const title = titleInput ? titleInput.value || 'Untitled' : 'Untitled';
  
  // Check if post is published (from postState or create_post_ui.isPublished)
  const isPublished = postState.published || (mod.create_post_ui && mod.create_post_ui.isPublished) || false;
  const accessLevel = postState.accessLevel || 'public';
  
  // Get content for size calculation (using DOM-based serialization if available)
  const editor = document.querySelector('#stack-post-body-editor');
  let content = '';
  if (editor && mod.create_post_ui && mod.create_post_ui.serializeDOMToMarkdown) {
    content = mod.create_post_ui.serializeDOMToMarkdown();
  }
  
  // Calculate content size
  const contentSize = new Blob([content]).size;
  const contentSizeKB = (contentSize / 1024).toFixed(1);
  
  // Get timestamps
  const now = new Date();
  const createdDate = postState.createdAt ? new Date(postState.createdAt) : now;
  const updatedDate = postState.updatedAt ? new Date(postState.updatedAt) : now;
  
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Map internal access levels to display
  // 'public' -> 'public', 'private' -> 'private', 'subscription' -> 'subscription'
  const isPublic = accessLevel === 'public';
  const isPrivate = accessLevel === 'private';
  const isSubscription = accessLevel === 'subscription';

  return `
    <div class="stack-publish-overlay">
      <div class="stack-publish-content">
        <!-- Three Equal-Height Cards -->
        <div class="stack-publish-cards">
          
          <!-- CARD 1: STATUS + PRIMARY ACTION -->
          <div class="stack-publish-card stack-publish-card-status">
            <button id="stack-publish-primary-btn" class="stack-publish-primary-action-btn">
              ${isPublished ? 'Update' : 'Publish'}
            </button>
            <p class="stack-publish-draft-explanation">
              This draft is saved only on your device.<br>
              Publish to broadcast it to the network.
            </p>
          </div>

          <!-- CARD 2: ACCESS CONTROL -->
          <div class="stack-publish-card stack-publish-card-access">
            <h3 class="stack-publish-card-title">Who can read this post?</h3>
            <div class="stack-publish-access-cards">
              <label class="stack-publish-access-card ${isPublic ? 'stack-publish-access-card-active' : ''}" data-access="public">
                <input 
                  type="checkbox" 
                  name="stack-publish-access" 
                  value="public" 
                  ${isPublic ? 'checked' : ''}
                  class="stack-publish-access-checkbox"
                />
                <div class="stack-publish-access-card-content">
                  <div class="stack-publish-access-card-label">Public</div>
                  <div class="stack-publish-access-card-description">Anyone with the link can read this post.</div>
                </div>
              </label>

              <label class="stack-publish-access-card ${isPrivate ? 'stack-publish-access-card-active' : ''}" data-access="private">
                <input 
                  type="checkbox" 
                  name="stack-publish-access" 
                  value="private" 
                  ${isPrivate ? 'checked' : ''}
                  class="stack-publish-access-checkbox"
                />
                <div class="stack-publish-access-card-content">
                  <div class="stack-publish-access-card-label">Private</div>
                  <div class="stack-publish-access-card-description">Only people who own NFTs you issued can read this post.</div>
                </div>
              </label>

              <label class="stack-publish-access-card stack-publish-access-card-disabled ${isSubscription ? 'stack-publish-access-card-active' : ''}" data-access="subscription">
                <input 
                  type="checkbox" 
                  name="stack-publish-access" 
                  value="subscription" 
                  ${isSubscription ? 'checked' : ''}
                  disabled
                  class="stack-publish-access-checkbox"
                />
                <div class="stack-publish-access-card-content">
                  <div class="stack-publish-access-card-label">Subscription</div>
                  <div class="stack-publish-access-card-description">Coming soon – time limited access</div>
                </div>
              </label>
            </div>
          </div>

          <!-- CARD 3: METADATA (READ-ONLY) -->
          <div class="stack-publish-card stack-publish-card-metadata">
            <h3 class="stack-publish-card-title">Metadata</h3>
            <div class="stack-publish-metadata-list">
              <div class="stack-publish-metadata-row">
                <span class="stack-publish-metadata-label">Status</span>
                <span class="stack-publish-metadata-value">${isPublished ? 'Published' : 'Draft'}</span>
              </div>
              <div class="stack-publish-metadata-row">
                <span class="stack-publish-metadata-label">Created</span>
                <span class="stack-publish-metadata-value">${formatDate(createdDate)}</span>
              </div>
              <div class="stack-publish-metadata-row">
                <span class="stack-publish-metadata-label">Last updated</span>
                <span class="stack-publish-metadata-value">${formatDate(updatedDate)}</span>
              </div>
              <div class="stack-publish-metadata-row">
                <span class="stack-publish-metadata-label">Size</span>
                <span class="stack-publish-metadata-value">${contentSizeKB} KB</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Bottom Actions -->
        <div class="stack-publish-bottom-actions">
          <div class="stack-publish-bottom-actions-spacer"></div>
          <button id="stack-publish-delete-draft-btn" class="stack-publish-delete-btn">
            Delete Draft
          </button>
        </div>
      </div>
    </div>
  `;
};
