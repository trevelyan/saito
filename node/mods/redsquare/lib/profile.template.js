module.exports = (profile) => {
  let p = profile.profile || {};
  const publicKey = p.publicKey || profile.mod?.publicKey || '';
  const name = p.name || 'Anonymous';
  const avatar = p.avatar || '/saito/img/dreamscape.png';
  const banner = p.banner || '';
  const bio = p.bio != null ? String(p.bio) : '';
  const canEdit = Boolean(p.can_edit);

  const keyHtml = publicKey
    ? `
      <div class="key-row">
        <span class="public-key" title="${publicKey}">${publicKey}</span>
        <button
          class="copy-key saito-icon-button"
          type="button"
          data-profile-key="${publicKey}"
          aria-label="Copy address"
          title="Copy address"
        >
          <i class="fas fa-copy" aria-hidden="true"></i>
        </button>
      </div>
    `
    : '';

  const bannerEditHtml = canEdit
    ? `<i id="redsquare-profile-banner-edit" class="redsquare-profile-banner-edit fas fa-camera" role="button" tabindex="0" aria-label="Edit banner"></i>`
    : '';

  const descriptionClass = [
    'redsquare-profile-description',
    canEdit ? 'can-edit' : '',
    !bio ? 'empty' : ''
  ]
    .filter(Boolean)
    .join(' ');

  let descriptionInner = '';
  if (bio) {
    descriptionInner = `
      <div id="profile-description-${publicKey}" class="profile-description-${publicKey}" data-id="${publicKey}">${bio}</div>
      ${canEdit ? `<div class="redsquare-profile-description-edit"><i class="fas fa-pen"></i></div>` : ''}
    `;
  } else if (canEdit) {
    descriptionInner = profile.emptyBioPlaceholderHtml
      ? profile.emptyBioPlaceholderHtml()
      : `<div class="redsquare-profile-description-edit placeholder"></div>`;
  }

  const bannerStyle = banner ? ` style="background-image: url('${banner}')"` : '';

  // Injected into `.sidebar-right > .redsquare-profile` — no outer wrapper here.
  // Posts / Replies / Likes are navigation destinations, not tabs.
  // Compose lives in the feed header (`.actions`), not here.
  return `
      <div class="card" data-profile-key="${publicKey}">
        <div id="banner-${publicKey}" class="redsquare-profile-banner banner-${publicKey}" data-id="${publicKey}"${bannerStyle}>
          ${bannerEditHtml}
        </div>
        <div class="body">
          <div class="identity">
            <img class="avatar" src="${avatar}" alt="${name}" />
            <div class="text">
              <span class="name">${name}</span>
              ${keyHtml}
            </div>
          </div>
          <div class="${descriptionClass}">${descriptionInner}</div>
          <nav class="nav" aria-label="Profile navigation">
            <div class="item" role="link" tabindex="0" data-profile-nav="posts">Posts</div>
            <div class="item" role="link" tabindex="0" data-profile-nav="replies">Replies</div>
            <div class="item" role="link" tabindex="0" data-profile-nav="likes">Likes</div>
          </nav>
        </div>
      </div>
  `;
};
