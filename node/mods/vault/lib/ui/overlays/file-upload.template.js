const { saitoFileDropOverlay } = require('../../../../../lib/saito/ui/saito-file-drop/saito-file-drop.template');

module.exports = (app, mod, isMobile = false) => {
  const uploadPrompt = isMobile ? 'Tap to Add File' : 'Drag and Drop File to Upload';

  const keyStepHtml = `
    <div class="key-step">
      <div class="saito-overlay-form-text" data-key-copy></div>
      <div class="key-artwork" aria-hidden="true"></div>
      <div class="saito-button-row">
        <div class="saito-anchor" data-action="toggle-mode"><span>create custom key...</span></div>
        <button type="button" class="saito-button-primary" data-action="confirm-key">CREATE KEY</button>
      </div>
      <div class="spinner-helper">uploading...<p></p><div class="saito-spinner"></div></div>
    </div>`;

  return saitoFileDropOverlay({
    title: 'Select File',
    prompt: uploadPrompt,
    dropzoneId: 'vault-file-upload',
    rootClass: 'vault-upload-overlay',
    extraBodyHtml: keyStepHtml
  });
};
