/**
 * Choose Draft Overlay Template
 * 
 * Vertical boxed layout showing up to 3 drafts, plus conditional "Create New Post" row
 * 
 * @param {Array} drafts - Array of draft objects (already sorted by most recent first)
 * @param {number} draftCount - Current draft count (used to enforce 3-draft limit)
 */
module.exports = (app, mod, drafts = [], draftCount = 0) => {
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Take up to 3 drafts (most recent first, already sorted)
  const displayedDrafts = drafts.slice(0, 3);
  
  // Calculate how many rows we need (drafts + optional CREATE NEW POST)
  const maxRows = 3;
  const draftRows = displayedDrafts.length;
  const showCreateNew = draftCount < 3;
  const totalRows = draftRows + (showCreateNew ? 1 : 0);

  return `
    <div class="stack-choose-draft-overlay">
      <div class="stack-choose-draft-content">
        <h2 class="stack-choose-draft-title">Resume a draft or start a new post</h2>
        
        <div class="stack-choose-draft-list-container">
          ${displayedDrafts.map((draft) => `
            <div class="stack-choose-draft-row" data-draft-id="${draft.id || ''}">
              <div class="stack-choose-draft-row-content">
                <div class="stack-choose-draft-row-header">
                  <div class="stack-choose-draft-row-title">${app.browser.escapeHTML(draft.title || 'Untitled')}</div>
                  <i class="fa-solid fa-trash stack-choose-draft-row-delete" data-draft-id="${draft.id || ''}" title="Delete draft"></i>
                </div>
                ${draft.lastModified ? `
                  <div class="stack-choose-draft-row-meta">${formatDate(draft.lastModified)}</div>
                ` : ''}
              </div>
            </div>
          `).join('')}

          ${showCreateNew ? `
            <!-- CREATE NEW POST row (only shown if fewer than 3 drafts) -->
            <div class="stack-choose-draft-row stack-choose-draft-row-create-new" id="stack-choose-draft-create-new">
              <div class="stack-choose-draft-row-content">
                <div class="stack-choose-draft-row-header">
                  <div class="stack-choose-draft-row-title">
                    <i class="fa-solid fa-plus" style="margin-right: 0.8rem;"></i>Create New Post
                  </div>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
};
