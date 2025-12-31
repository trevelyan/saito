module.exports = (app, mod) => {
  return `
    <div class="stack-create-post-page">
      <div class="stack-create-post-container">
        <div class="stack-editor-content-wrapper">
          <div class="stack-document-column">
            <!-- Featured Image Display (in main page layout, above title) -->
            <div id="stack-featured-image-display" class="stack-featured-image-display" style="display: none;">
              <div class="stack-featured-image-display-container">
                <img id="stack-featured-image-display-img" class="stack-featured-image-display-img" src="" alt="Featured image" />
                <div id="stack-featured-image-display-remove" class="stack-featured-image-display-remove" title="Remove featured image">
                  <i class="fa-solid fa-trash"></i>
                </div>
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
            
            <!-- Featured Image Upload Section (in sidebar, between Status and Publish button) -->
            <!-- Upload box is only a chooser - image appears in main layout above title -->
            <div id="stack-featured-image-section" class="stack-featured-image-section">
              <!-- Upload Dropzone (shown when no image) -->
              <div id="stack-featured-image-dropzone" class="stack-featured-image-dropzone">
                <div class="stack-featured-image-dropzone-content">
                  <i class="fa-solid fa-image stack-featured-image-upload-icon"></i>
                  <p class="stack-featured-image-dropzone-text">Drag and drop an image here</p>
                  <p class="stack-featured-image-dropzone-subtext">or click to upload</p>
                </div>
              </div>
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
