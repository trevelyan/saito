/**
 * Post Teaser Template
 * 
 * Editorial-style blog post preview component.
 * Reads from transaction data: tx.msg.data.title, subtitle, summary, image, timestamp
 * 
 * Structure:
 * - Feature image (left on desktop, top on mobile)
 * - Title (required, dominant)
 * - Subtitle OR summary (optional, clamped to 1-2 lines)
 * - Published date (optional, subtle)
 */
module.exports = (app, mod, post) => {
  // Support both transaction objects and post objects
  let data = {};
  let timestamp = null;
  let postId = '';
  let publicKey = '';
  
  if (post && post.msg) {
    // Transaction object
    const msg = post.returnMessage ? post.returnMessage() : post.msg;
    data = msg.data || {};
    timestamp = post.timestamp || data.timestamp || null;
    postId = post.signature || post.id || '';
    publicKey = post.from && post.from.length > 0 ? post.from[0].publicKey : '';
  } else {
    // Post object (legacy support)
    data = post || {};
    timestamp = post.timestamp || null;
    postId = post.id || post.signature || post.sig || '';
    publicKey = post.publicKey || (post.author && post.author.publicKey) || post.author || '';
  }
  
  // Extract fields from transaction data structure
  const title = data.title || 'Untitled post';
  const subtitle = data.subtitle || null;
  const summary = data.summary || data.excerpt || null;
  const image = data.image || null;
  const imageUrl = data.imageUrl || null;
  
  // Always use an image - fallback to placeholder if none provided
  let displayImage = imageUrl || '/saito/img/dreamscape.png';
  if (image && !imageUrl) {
    // Convert base64 to data URL
    const mimeType = 'image/png'; // Default
    displayImage = `data:image/${mimeType};base64,${image}`;
  }
  
  // Format date (subtle, optional)
  let dateString = null;
  if (timestamp && app.browser.formatDate) {
    const date = app.browser.formatDate(timestamp);
    if (date) {
      dateString = `${date.month} ${date.day}, ${date.year}`;
    }
  }
  
  // Prefer subtitle, fallback to summary
  const description = subtitle || summary;
  
  // Clamp description to approximately 120 characters (1-2 lines)
  let displayDescription = null;
  if (description) {
    const maxLength = 120;
    displayDescription = description.length > maxLength 
      ? description.substring(0, maxLength).trim() + '...'
      : description;
  }
  
  return `
    <article class="stack-post-teaser" data-tx-signature="${postId}" data-post-id="${postId}" data-public-key="${publicKey}">
      <div class="stack-post-teaser-image">
        <img src="${app.browser.escapeHTML(displayImage)}" alt="${app.browser.escapeHTML(title)}" />
      </div>
      
      <div class="stack-post-teaser-content">
        <h3 class="stack-post-teaser-title">${app.browser.escapeHTML(title)}</h3>
        
        ${displayDescription ? `
          <p class="stack-post-teaser-description">${app.browser.escapeHTML(displayDescription)}</p>
        ` : ''}
        
        ${dateString ? `
          <div class="stack-post-teaser-meta">
            <time class="stack-post-teaser-date">${dateString}</time>
          </div>
        ` : ''}
      </div>
    </article>
  `;
};

