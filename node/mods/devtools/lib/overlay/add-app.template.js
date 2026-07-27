const { saitoFileDropOverlay } = require('../../../../lib/saito/ui/saito-file-drop/saito-file-drop.template');

module.exports = AddAppOverlayTemplate = (app, mod, isMobile = false) => {
  const prompt = isMobile
    ? 'Tap to Install .saito Module'
    : 'Drag and Drop .saito Module to Install';

  return saitoFileDropOverlay({
    title: 'Install Module',
    prompt,
    dropzoneId: 'saito-app-upload',
    rootClass: 'saito-app-overlay',
  });
};
