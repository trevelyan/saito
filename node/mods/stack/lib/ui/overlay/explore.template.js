const PostTeaser = require('../post-teaser');

module.exports = (app, mod, posts = [], isLoading = false) => {
  return `
    <div class="stack-explore-overlay">
      <div class="stack-explore-sidebar">
        <div class="stack-explore-sidebar-header">
          <h2>Explore</h2>
          <button class="stack-explore-add-subscription-btn" id="stack-explore-add-subscription-btn" title="Add subscription">
            <i class="fa-solid fa-plus"></i>
          </button>
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
        <!-- Author Identity Header - Context-aware based on selected subscription -->
        <div class="stack-explore-author-header" id="stack-explore-author-header">
          <!-- Will be populated by JavaScript using SaitoUser component -->
          <!-- Subscribe button appears here when viewing via URL routing and not already subscribed -->
          <div id="stack-explore-subscribe-button-container" style="display: none;">
            <button class="stack-explore-subscribe-btn" id="stack-explore-subscribe-btn">
              Subscribe
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

