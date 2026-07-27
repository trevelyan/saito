module.exports = InstallAppOverlayTemplate = (app, mod, this_self) => {
  const name = this_self.name || 'Untitled Module';
  const description = this_self.description || '';
  const version = this_self.version || '—';
  const categories = this_self.categories || '—';
  const image = this_self.image || '';

  const publisherKey = this_self.tx?.from?.[0]?.publicKey;
  const publisherHtml = publisherKey
    ? `<span class="value">${publisherKey}</span>`
    : `<em class="unknown">unknown</em>`;

  const bannerStyle = image ? ` style="background-image: url(${image});"` : '';

  return `
  <div class="saito-module-overlay saito-app-install-overlay">
    <header class="banner"${bannerStyle}>
      <h2 class="title">${name}</h2>
    </header>

    ${description ? `<p class="description">${description}</p>` : ''}

    <div class="meta">
      <div class="row">
        <span class="label">Version</span>
        <span class="value">${version}</span>
      </div>
      <div class="row">
        <span class="label">Publisher</span>
        ${publisherHtml}
      </div>
      <div class="row">
        <span class="label">Categories</span>
        <span class="value">${categories}</span>
      </div>
    </div>

    <div class="saito-button-row">
      <button type="button" class="saito-button-primary" id="saito-app-install-btn">Install</button>
    </div>
  </div>
  `;
};
