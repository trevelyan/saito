const CreateTemplate = require('./create.template');

/**
 * Sidebar Create — publishing actions (not identity, not navigation).
 *
 * Built-in actions: Post, Tweet (left → right).
 * Extension:
 *   - `registerAction({ id, label, icon, onClick })` before/after render
 *   - modules may `respondTo('redsquare-create')` with
 *     `{ id, label, icon?, callback(app, mod) }`
 */
class Create {
  constructor(app, mod, container = '') {
    this.app = app;
    this.mod = mod;
    this.container = container;
    this._extra_actions = [];
  }

  /**
   * Ordered create actions. Core first; module extras appended (deduped by id).
   * Left → right: Post, Tweet (handlers unchanged).
   */
  getActions() {
    const actions = [
      {
        id: 'post',
        label: '+ Post',
        onClick: () => this.openPost()
      },
      {
        id: 'tweet',
        label: '+ Tweet',
        onClick: () => this.openTweet()
      }
    ];

    const seen = new Set(actions.map((a) => a.id));

    for (const action of this._extra_actions) {
      if (!action?.id || !action?.label || seen.has(action.id)) {
        continue;
      }
      seen.add(action.id);
      actions.push(action);
    }

    const peers = this.app.modules?.getRespondTos?.('redsquare-create') || [];
    for (const item of peers) {
      if (!item?.id || !item?.label || seen.has(item.id)) {
        continue;
      }
      seen.add(item.id);
      actions.push({
        id: item.id,
        label: item.label,
        icon: item.icon || 'fa-solid fa-plus',
        onClick: () => item.callback?.(this.app, this.mod)
      });
    }

    return actions;
  }

  /**
   * Register an additional create action (e.g. from a peer module at init).
   */
  registerAction(action = {}) {
    if (!action.id || !action.label) {
      return;
    }

    this._extra_actions = this._extra_actions.filter((a) => a.id !== action.id);
    this._extra_actions.push(action);

    if (document.querySelector(this.container)) {
      this.render();
    }
  }

  openTweet() {
    this.mod.compose_overlay?.open();
  }

  openPost() {
    // TODO(redsquare-create): Wire Stack's create-post UI in-place once Stack
    // exposes a stable cross-module entry (prefer respondTo('redsquare-create')
    // from Stack, or a create_post_ui.openFromPeer() API). Until then, open Stack.
    const stack = this.app.modules?.returnModule?.('Stack');

    if (stack && typeof navigateWindow === 'function') {
      navigateWindow('/stack');
      return;
    }

    if (typeof navigateWindow === 'function') {
      navigateWindow('/stack');
      return;
    }

    console.info(
      '[RedSquare Create] Post placeholder — Stack create hook not available in this session.'
    );
  }

  render(container = '') {
    if (container) {
      this.container = container;
    }

    if (!document.querySelector(this.container)) {
      return;
    }

    this.app.browser.replaceElementContentBySelector(CreateTemplate(this), this.container);
    this.attachEvents();
  }

  attachEvents() {
    const root = document.querySelector(this.container);

    if (!root || root.dataset.createBound === '1') {
      return;
    }

    root.dataset.createBound = '1';

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-create]');

      if (!btn || !root.contains(btn)) {
        return;
      }

      e.preventDefault();

      const id = btn.getAttribute('data-create');
      const action = this.getActions().find((a) => a.id === id);

      action?.onClick?.();
    });
  }
}

module.exports = Create;
