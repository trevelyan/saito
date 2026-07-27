/**
 * Shared file-drop overlay shell — used by Vault Upload and Install Module.
 * Parents configure title / prompt / dropzone id; this owns markup structure.
 *
 * Optional `extraBodyHtml` is injected above the dropzone (e.g. Vault key step).
 */
function saitoFileDropOverlay({
  title = 'Select File',
  prompt = 'Drag and Drop File to Upload',
  dropzoneId = 'saito-file-drop',
  rootClass = '',
  extraBodyHtml = ''
} = {}) {
  return `
<div class="saito-overlay-form saito-file-drop-overlay ${rootClass}">
  <div class="saito-overlay-form-header">
    <h2 class="saito-overlay-form-header-title">${title}</h2>
  </div>
  <div class="saito-file-drop-body">
    ${extraBodyHtml}
    <div class="saito-file-drop-zone-wrap">
      <div class="saito-file-dropzone active-tab paste_event" id="${dropzoneId}">
        <i class="fa-solid fa-file-arrow-up" aria-hidden="true"></i>
        <div class="saito-file-dropzone-text">${prompt}</div>
      </div>
    </div>
  </div>
</div>`;
}

module.exports = { saitoFileDropOverlay };
