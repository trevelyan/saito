module.exports = (app, mod) => {
  return `
    <div class="stack-create-post-page">
      <div class="stack-create-post-container">
        <div class="stack-editor-content-wrapper">
          <div class="stack-document-column">
            <!-- Featured Image Upload Section (above title) -->
            <div id="stack-featured-image-section" class="stack-featured-image-section">
              <!-- Upload Dropzone (shown when no image) -->
              <div id="stack-featured-image-dropzone" class="stack-featured-image-dropzone" style="display: none;">
                <div class="stack-featured-image-dropzone-content">
                  <i class="fa-solid fa-image stack-featured-image-upload-icon"></i>
                  <p class="stack-featured-image-dropzone-text">Drag and drop an image here</p>
                  <p class="stack-featured-image-dropzone-subtext">or click to upload</p>
                </div>
              </div>
              
              <!-- Image Preview (shown when image exists) -->
              <div id="stack-featured-image-preview-container" class="stack-featured-image-preview-container" style="display: none;">
                <img id="stack-featured-image-preview" class="stack-featured-image-preview" src="" alt="Featured image" />
                <button id="stack-featured-image-remove-btn" class="stack-featured-image-remove-btn" title="Remove featured image">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
            
            <div class="stack-post-title-field">
              <input 
                type="text" 
                id="stack-post-title-input" 
                class="stack-post-title-input" 
                placeholder="Untitled Post"
              />
            </div>
            
            <div class="stack-post-body-field">
              <div 
                id="stack-post-body-editor" 
                class="stack-post-body-editor"
                contenteditable="true"
                data-placeholder="Start writing..."
              ></div>
            </div>
            
          </div>
          
          <div class="stack-editor-sidebar">
            <div class="stack-editor-status">
              <span class="stack-editor-status-label">Status:</span> <span class="stack-editor-status-value" id="stack-editor-status-value">Draft</span>
            </div>
            
            <button class="stack-editor-publish-btn" id="stack-editor-publish-btn">
              Publish
            </button>
            
            <div class="stack-editor-help">
              <span class="stack-editor-help-text">
                <a href="#" class="stack-editor-help-link" id="stack-editor-help-link">Need help?</a> Learn how to write posts, add headers, quotes, images, and publish to the network.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
};
