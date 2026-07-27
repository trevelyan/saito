const MainTemplate = require('./main.template');
const Menu = require('./menu');
const Composer = require('./composer');
const Profile = require('./profile');
const Create = require('./create');
const Sidebar = require('./sidebar');

class Main {
  constructor(app, mod, container = '#saito-container') {
    this.app = app;
    this.mod = mod;
    this.container = container;

    this.composer = new Composer(app, mod);
    this.menu = new Menu(app, mod, '.sidebar-left', this.composer);
    this.manager = mod.manager;
    this.manager.container = '.manager';
    this.profile = new Profile(app, mod, '.sidebar-right > .redsquare-profile');
    this.create = new Create(app, mod, '.sidebar-right > .redsquare-create');
    this.sidebar = new Sidebar(app, mod, '.sidebar-right > .sidebar');
    this.active_mobile_view = 'feed';
    this.chat_manager = null;
  }

  setChatManager(chatManager = null) {
    this.chat_manager = chatManager;
    this.syncChatManagerContainer();
  }

  hasChatCapability() {
    return Boolean(this.chat_manager && typeof this.chat_manager.render === 'function');
  }

  isCompactViewport() {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 600px)').matches
    );
  }

  syncChatManagerContainer() {
    if (!this.hasChatCapability()) {
      return;
    }

    const compact = this.isCompactViewport();

    this.chat_manager.container = compact ? '.redsquare-mobile-chat' : '.sidebar-left';
    this.chat_manager.chat_popup_container = compact ? '.redsquare-mobile-chat' : '';
    this.chat_manager.render_manager_to_screen = 1;
  }

  showMobileView(view = 'feed') {
    if (!this.isCompactViewport()) {
      return false;
    }

    if (view === 'chat' && !this.hasChatCapability()) {
      view = 'feed';
    }

    document.querySelectorAll('.main > [data-mobile-view]').forEach((panel) => {
      panel.hidden = panel.dataset.mobileView !== view;
    });

    this.active_mobile_view = view;
    document.body.dataset.redsquareMobileView = view;

    if (view === 'settings') {
      this.renderMobileSettings();
    }

    if (view === 'chat') {
      this.syncChatManagerContainer();
      this.chat_manager.render();
    }

    return true;
  }

  renderMobileSettings() {
    const container = '.redsquare-mobile-settings';
    const host = document.querySelector(container);

    if (!host || host.querySelector('#redsquare-settings-overlay')) {
      return;
    }

    this.mod.settings_overlay?.renderInto(container);
  }

  render(container = '') {
    if (container) {
      this.container = container;
    }

    if (!document.querySelector(this.container)) {
      this.app.browser.addElementToDom(MainTemplate());
    } else {
      this.app.browser.replaceElementContentBySelector(MainTemplate(), this.container);
    }

    this.syncChatManagerContainer();

    this.menu.render();
    this.manager.render();
    this.profile.render();
    this.create.render();
    this.sidebar.render();

    if (this.isCompactViewport()) {
      this.showMobileView(this.active_mobile_view);
    }

    this.attachEvents();
  }

  attachSidebarScrollSync() {
    const root = document.querySelector(this.container);
    const scroller = root?.querySelector('.manager .body');

    if (!scroller || scroller.dataset.sidebarScrollSyncBound === '1') {
      return;
    }

    scroller.dataset.sidebarScrollSyncBound = '1';

    let previousScrollTop = scroller.scrollTop;
    let frame = null;

    scroller.addEventListener(
      'scroll',
      () => {
        if (frame !== null) {
          return;
        }

        frame = window.requestAnimationFrame(() => {
          frame = null;

          const currentScrollTop = scroller.scrollTop;
          const scrollDelta = currentScrollTop - previousScrollTop;
          previousScrollTop = currentScrollTop;

          if (scrollDelta === 0 || this.isCompactViewport()) {
            return;
          }

          root.querySelectorAll('.sidebar-left, .sidebar-right').forEach((sidebar) => {
            if (sidebar.clientHeight > 0 && sidebar.scrollHeight > sidebar.clientHeight) {
              sidebar.scrollTop += scrollDelta;
            }
          });
        });
      },
      { passive: true }
    );
  }

  canConsumeWheel(target, root, scrollDelta) {
    let element = target?.nodeType === 1 ? target : target?.parentElement;

    while (element && element !== root) {
      const overflowY = window.getComputedStyle(element).overflowY;

      if (
        (overflowY === 'auto' || overflowY === 'scroll') &&
        element.scrollHeight > element.clientHeight
      ) {
        const maxScrollTop = element.scrollHeight - element.clientHeight;

        if (
          (scrollDelta < 0 && element.scrollTop > 0) ||
          (scrollDelta > 0 && element.scrollTop < maxScrollTop)
        ) {
          return true;
        }
      }

      element = element.parentElement;
    }

    return false;
  }

  attachFeedWheelScroll() {
    const root = document.querySelector(this.container);
    const scroller = root?.querySelector('.manager .body');

    if (!root || !scroller || root.dataset.feedWheelScrollBound === '1') {
      return;
    }

    root.dataset.feedWheelScrollBound = '1';

    root.addEventListener(
      'wheel',
      (event) => {
        if (
          event.defaultPrevented ||
          event.ctrlKey ||
          event.deltaY === 0 ||
          this.isCompactViewport() ||
          scroller.contains(event.target) ||
          this.canConsumeWheel(event.target, root, event.deltaY)
        ) {
          return;
        }

        const deltaScale =
          event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroller.clientHeight : 1;
        const previousScrollTop = scroller.scrollTop;

        scroller.scrollTop += event.deltaY * deltaScale;

        if (scroller.scrollTop !== previousScrollTop) {
          event.preventDefault();
        }
      },
      { passive: false }
    );
  }

  attachEvents() {
    this.menu.attachEvents();
    this.manager.attachEvents();
    this.profile.attachEvents();
    this.create.attachEvents();
    this.sidebar.attachEvents();
    this.attachSidebarScrollSync();
    this.attachFeedWheelScroll();
  }
}

module.exports = Main;
