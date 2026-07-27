module.exports = (create) => {
  const actions = (create.getActions?.() || create.actions || [])
    .map(
      (action) => `
        <button
          type="button"
          class="action saito-button-secondary compact"
          data-create="${action.id}"
          aria-label="${action.label}"
        >
          <span>${action.label}</span>
        </button>
      `
    )
    .join('');

  // Injected into `.sidebar-right > .redsquare-create` — compact action bar.
  return `
      <div class="actions saito-sidebar-element">
        ${actions}
      </div>
  `;
};
