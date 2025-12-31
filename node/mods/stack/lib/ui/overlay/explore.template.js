const PostTeaser = require('../post-teaser');

module.exports = (app, mod, posts = [], isLoading = false) => {
  return `
    <div class="stack-explore-overlay">
      <div class="stack-explore-sidebar">
        <div class="stack-explore-sidebar-header">
          <h2>Explore</h2>
        </div>
        <div class="stack-explore-sidebar-content">
          <div class="stack-explore-subscriptions-list">
            <div class="stack-explore-subscription-item active" data-filter="all">
              <i class="fa-solid fa-newspaper"></i>
              <span>Saito Official</span>
            </div>
            <div class="stack-explore-subscription-item" data-filter="my-posts">
              <i class="fa-solid fa-user"></i>
              <span>My Posts</span>
            </div>
          </div>
          
          <!-- Contextual help note - only shown when subscription list is short (2 or fewer) -->
          <div class="stack-explore-help-note">
            <p>Need help? Explore shows posts from people you follow. Subscribe to creators to see their posts here.</p>
          </div>
        </div>
      </div>
      
      <div class="stack-explore-main">
        <!-- Main Panel Header - Contains author identity and action links -->
        <div class="stack-explore-main-header">
          <!-- Author Identity Header - Context-aware based on selected subscription -->
          <div class="stack-explore-author-header" id="stack-explore-author-header">
            <!-- TEMPORARY: Hardcoded identity placeholder - will be replaced by JavaScript SaitoUser component -->
            <!-- This ensures the left-side anchor is always present for layout stability -->
            <div class="saito-user" style="display: flex; align-items: center; gap: 1rem;">
              <div class="saito-userline" style="display: flex; align-items: center; gap: 1rem;">
                <div class="saito-userline-identicon" style="width: 3.6rem; height: 3.6rem; border-radius: 50%; background: var(--saito-primary); opacity: 0.3;"></div>
                <div class="saito-userline-name" style="font-size: 1.8rem; font-weight: 600; color: var(--saito-font-color);">Loading...</div>
              </div>
            </div>
            <!-- Subscribe button appears here when viewing via URL routing and not already subscribed -->
            <div id="stack-explore-subscribe-button-container" style="display: none;">
              <button class="stack-explore-subscribe-btn" id="stack-explore-subscribe-btn">
                Subscribe
              </button>
            </div>
          </div>
          
          <!-- Action Button Container (in main panel header, right-aligned) -->
          <div class="stack-explore-action-button-container">
            <button class="stack-explore-add-subscription-btn" id="stack-explore-add-subscription-btn" style="display: none;">
              Add user
            </button>
            <button class="stack-explore-settings-btn" id="stack-explore-settings-btn" style="display: none;">
              Settings
            </button>
          </div>
        </div>

        <div class="stack-explore-content">
          <div class="stack-explore-posts-grid" id="stack-explore-posts-grid">
            ${isLoading ? `
              <!-- Loading state -->
              <div class="stack-explore-loading" style="display: flex; justify-content: center; align-items: center; min-height: 200px; padding: 4rem 2rem;">
                <div style="text-align: center;">
                  <i class="fa-solid fa-spinner fa-spin" style="font-size: 3rem; color: var(--saito-font-color-light); margin-bottom: 1rem;"></i>
                  <p style="color: var(--saito-font-color-light); font-size: 1.6rem;">Loading posts...</p>
                </div>
              </div>
            ` : posts.length > 0 ? `
              <!-- Populated state - render real posts using PostTeaser UI component -->
              ${posts.map(transaction => {
                const teaser = new PostTeaser(app, mod, '', transaction);
                return teaser.render(); // Returns HTML string for template
              }).join('')}
            ` : `
              <!-- Empty state -->
              <div class="stack-explore-empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; padding: 4rem 2rem; text-align: center;">
                <i class="fa-solid fa-newspaper" style="font-size: 4rem; color: var(--saito-font-color-light); opacity: 0.5; margin-bottom: 2rem;"></i>
                <h3 style="font-size: 2rem; font-weight: 600; color: var(--saito-font-color); margin: 0 0 1rem 0;">No posts available</h3>
                <p style="font-size: 1.6rem; color: var(--saito-font-color-light); margin: 0; max-width: 500px; line-height: 1.6;">
                  No posts are visible at this time. This may be because no posts have been published yet, or you may need to subscribe to see content from this creator.
                </p>
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
};

