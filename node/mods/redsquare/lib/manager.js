const ManagerTemplate = require('./manager.template');
const ManagerHeaderTemplate = require('./manager-header.template');
const ManagerScrollFooterTemplate = require('./manager-scroll-footer.template');
const ManagerLoadMore = require('./manager-load-more');
const TweetTemplate = require('./tweet.template');

const SCROLL_THRESHOLD_PX = 240;

class Manager {
  constructor(app, mod, container = '') {
    this.app = app;
    this.mod = mod;
    this.container = container;

    this.mode = 'timeline';
    this.active_signature = '';
    this.active_thread_id = '';
    this.active_profile_key = '';

    this.timeline_rendered = false;
    this.notifications_rendered = false;
    this.scroll_positions = {
      timeline: 0,
      notifications: 0,
      thread: 0,
      posts: 0,
      replies: 0,
      likes: 0
    };

    this.pagination = this.createPaginationState();
    this.pending_newer_tweets = [];
    this._timeline_bootstrapping = false;
    this._notifications_bootstrapping = false;

    // Per-view Manager chrome. Header is navigation only (back + title).
    // Home / notifications omit it so the feed begins with content.
    // Thread and profile detail views keep it for back navigation.
    this.viewChrome = {
      timeline: { header: false },
      notifications: { header: false },
      thread: { header: true },
      posts: { header: true },
      replies: { header: true },
      likes: { header: true }
    };
  }

  createPaginationState() {
    return {
      timeline: {
        cursor: 0,
        batchSize: 5,
        loading: false,
        exhausted: false,
        mockPage: 0
      },
      notifications: {
        cursor: 0,
        batchSize: 2,
        loading: false,
        exhausted: false,
        mockPage: 0
      },
      thread: {
        cursor: 0,
        batchSize: 2,
        loading: false,
        exhausted: false,
        mockPage: 0,
        chain: []
      },
      posts: {
        cursor: 0,
        batchSize: 20,
        loading: false,
        exhausted: false
      },
      replies: {
        cursor: 0,
        batchSize: 20,
        loading: false,
        exhausted: false
      },
      likes: {
        cursor: 0,
        batchSize: 20,
        loading: false,
        exhausted: false
      }
    };
  }

  renderTimeline() {
    const previousMode = this.mode;

    this.saveScrollPosition(previousMode);
    this.mode = 'timeline';
    this.active_signature = '';
    this.active_profile_key = '';
    this.render();

    if (previousMode !== 'timeline') {
      this.resetMenuToHome();
    }

    this.restoreScrollPosition('timeline');
    this.syncScrollFooter();
    this.syncPendingNewerTweets();
  }

  renderNotifications() {
    this.saveScrollPosition();
    this.mod.markNotificationsViewed?.();
    this.mode = 'notifications';
    this.active_profile_key = '';
    this.render();
    this.restoreScrollPosition('notifications');
    this.syncScrollFooter();
  }

  renderThread(signature) {
    this.saveScrollPosition();

    const tweet = this.mod.getTweet(signature);

    this.mode = 'thread';
    this.active_signature = signature || '';
    this.active_thread_id = tweet ? tweet.thread_id || tweet.signature : '';
    this.active_profile_key = '';
    this.scroll_positions.thread = 0;
    this.resetThreadPagination(signature);
    this.render();
    this.restoreScrollPosition('thread');
    this.syncScrollFooter();
  }

  renderPosts(publicKey = '') {
    this.renderProfileView('posts', publicKey);
  }

  renderReplies(publicKey = '') {
    this.renderProfileView('replies', publicKey);
  }

  renderLikes(publicKey = '') {
    this.renderProfileView('likes', publicKey);
  }

  renderProfileView(mode, publicKey = '') {
    this.saveScrollPosition();
    this.mode = mode;
    this.active_signature = '';
    this.active_thread_id = '';
    this.active_profile_key = publicKey || this.mod.publicKey || '';
    this.scroll_positions[mode] = 0;

    if (!this.pagination[mode]) {
      this.pagination[mode] = {
        cursor: 0,
        batchSize: 20,
        loading: false,
        exhausted: false
      };
    } else {
      this.pagination[mode].cursor = 0;
      this.pagination[mode].loading = false;
      this.pagination[mode].exhausted = false;
    }

    this.render();
    this.restoreScrollPosition(mode);
    this.syncFeedStatus();
  }

  render(container = '') {
    if (container) {
      this.container = container;
    }

    this.ensureShell();
    this.updateModeVisibility();

    switch (this.mode) {
      case 'thread':
        this.paintThread();
        break;
      case 'notifications':
        this.paintNotifications();
        break;
      case 'posts':
      case 'replies':
      case 'likes':
        this.paintProfileView();
        break;
      case 'timeline':
      default:
        this.paintTimeline();
        break;
    }

    this.syncFeedHeader();
    this.attachEvents();
    this.syncScrollFooter();
    this.syncProfileNav();
  }

  ensureShell() {
    const root = document.querySelector(this.container);

    if (
      root &&
      root.querySelector('.body') &&
      root.querySelector('.list[data-panel="timeline"]') &&
      root.querySelector('.list[data-panel="profile"]')
    ) {
      return;
    }

    this.app.browser.replaceElementContentBySelector(ManagerTemplate(), this.container);
    this.timeline_rendered = false;
    this.notifications_rendered = false;
    this.pagination = this.createPaginationState();
    this.pending_newer_tweets = [];
    this._timeline_bootstrapping = false;
    this._notifications_bootstrapping = false;
  }

  updateModeVisibility() {
    const root = document.querySelector(this.container);

    if (!root) {
      return;
    }

    const timeline = root.querySelector('.list[data-panel="timeline"]');
    const thread = root.querySelector('.list[data-panel="thread"]');
    const notifications = root.querySelector('.list[data-panel="notifications"]');
    const profile = root.querySelector('.list[data-panel="profile"]');
    const profileModes = this.mode === 'posts' || this.mode === 'replies' || this.mode === 'likes';

    if (timeline) {
      timeline.hidden = this.mode !== 'timeline';
    }

    if (thread) {
      thread.hidden = this.mode !== 'thread';
    }

    if (notifications) {
      notifications.hidden = this.mode !== 'notifications';
    }

    if (profile) {
      profile.hidden = !profileModes;
    }

    if (this.mode !== 'timeline') {
      this.hideNewPostsBanner();
    } else if (this.pending_newer_tweets.length) {
      this.showNewPostsBanner();
    }

    this.syncFeedHeader();
  }

  /**
   * Feed-header chrome — mounted only when the active view needs navigation.
   * Creation lives in the sidebar Create component, not here.
   */
  syncFeedHeader() {
    const root = document.querySelector(this.container);

    if (!root) {
      return;
    }

    const showHeader = this.requiresHeader();
    let header = root.querySelector(':scope > .header');

    if (showHeader) {
      if (!header) {
        const body = root.querySelector(':scope > .body');

        if (body) {
          body.insertAdjacentHTML('beforebegin', ManagerHeaderTemplate());
        } else {
          root.insertAdjacentHTML('afterbegin', ManagerHeaderTemplate());
        }

        header = root.querySelector(':scope > .header');
      }

      const title = header?.querySelector('.title');
      const back = header?.querySelector('.back');

      const labels = {
        timeline: 'Home',
        notifications: 'Notifications',
        thread: 'Post',
        posts: 'Profile',
        replies: 'Profile',
        likes: 'Profile'
      };

      if (title) {
        title.textContent = labels[this.mode] || 'Home';
      }

      const isDetail = this.isDetailHeaderMode();
      const showBack = this.mode !== 'timeline';

      if (back) {
        back.hidden = !showBack;
        back.setAttribute('aria-hidden', showBack ? 'false' : 'true');
      }

      root.classList.toggle('has-back', showBack);
      root.classList.toggle('detail', isDetail);
      root.classList.toggle('timeline', !isDetail);
    } else if (header) {
      header.remove();
      root.classList.remove('has-back', 'detail');
      root.classList.add('timeline');
    }

    root.classList.toggle('has-header', showHeader);
  }

  /**
   * Whether the active view requires Manager header chrome (back + title).
   * Driven by `viewChrome.header` on all viewports.
   */
  requiresHeader(mode = this.mode) {
    const chrome = this.viewChrome[mode];

    if (chrome && typeof chrome.header === 'boolean') {
      return chrome.header;
    }

    // Unknown views keep the header (navigation/context by default).
    return true;
  }

  isCompactViewport() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia('(max-width: 600px)').matches;
  }

  /**
   * Detail views show Back; thread is the primary detail case.
   */
  isDetailHeaderMode() {
    return this.mode === 'thread';
  }

  syncProfileNav() {
    this.mod.main?.profile?.syncActiveNav(this.mode);
  }

  navigateBackToTimeline() {
    this.renderTimeline();
  }

  getScrollContainer() {
    return (
      document.querySelector(`${this.container} .body`) ||
      document.querySelector('.manager .body') ||
      document.querySelector(this.container) ||
      document.querySelector('#saito-container') ||
      document.querySelector('.saito-container')
    );
  }

  saveScrollPosition(mode = this.mode) {
    const scroller = this.getScrollContainer();

    if (!scroller || !mode || !this.scroll_positions) {
      return;
    }

    this.scroll_positions[mode] = scroller.scrollTop;
  }

  restoreScrollPosition(mode = this.mode) {
    const scroller = this.getScrollContainer();

    if (!scroller || !mode || !this.scroll_positions) {
      return;
    }

    const scrollTop = this.scroll_positions[mode] || 0;

    requestAnimationFrame(() => {
      scroller.scrollTop = scrollTop;
    });
  }

  resetMenuToHome() {
    const homeItem = document.querySelector('.sidebar-left [data-nav="home"]');

    if (homeItem && this.mod.main?.menu) {
      this.mod.main.menu.setActiveMenuItem(homeItem);
    }
  }

  getPaginationState() {
    return this.pagination[this.mode] || this.pagination.timeline;
  }

  getEndMessage() {
    return this.getFeedStatusMessage('end');
  }

  getFeedStatusMessage(status) {
    const messages = {
      timeline: {
        loading: 'Loading tweets...',
        empty: 'No tweets yet.',
        end: 'No more tweets.'
      },
      notifications: {
        loading: 'Loading notifications...',
        empty: "You're all caught up",
        end: 'No more notifications.'
      },
      thread: {
        loading: 'Loading replies...',
        empty: 'No replies.',
        end: 'No more replies.'
      },
      posts: {
        loading: 'Loading posts...',
        empty: 'No posts yet.',
        end: 'No more posts.'
      },
      replies: {
        loading: 'Loading replies...',
        empty: 'No replies.',
        end: 'No more replies.'
      },
      likes: {
        loading: 'Loading likes...',
        empty: 'No liked posts.',
        end: 'No more liked posts.'
      }
    };

    return messages[this.mode]?.[status] || '';
  }

  isProfileMode() {
    return this.mode === 'posts' || this.mode === 'replies' || this.mode === 'likes';
  }

  getActivePanelElement() {
    const root = document.querySelector(this.container);

    if (!root) {
      return null;
    }

    switch (this.mode) {
      case 'thread':
        return root.querySelector('.list[data-panel="thread"]');
      case 'notifications':
        return root.querySelector('.list[data-panel="notifications"]');
      case 'posts':
      case 'replies':
      case 'likes':
        return root.querySelector('.list[data-panel="profile"]');
      case 'timeline':
      default:
        return root.querySelector('.list[data-panel="timeline"]');
    }
  }

  getActivePanelSelector() {
    switch (this.mode) {
      case 'thread':
        return `${this.container} .list[data-panel="thread"]`;
      case 'notifications':
        return `${this.container} .list[data-panel="notifications"]`;
      case 'posts':
      case 'replies':
      case 'likes':
        return `${this.container} .list[data-panel="profile"]`;
      case 'timeline':
      default:
        return `${this.container} .list[data-panel="timeline"]`;
    }
  }

  clearPanel(selector) {
    const panel = document.querySelector(selector);

    if (panel) {
      panel.innerHTML = '';
    }
  }

  paintTimeline() {
    if (this.timeline_rendered || this._timeline_bootstrapping) {
      this.syncFeedStatus();
      return;
    }

    this.bootstrapTimeline();
  }

  async bootstrapTimeline() {
    if (this.timeline_rendered || this._timeline_bootstrapping) {
      return;
    }

    this._timeline_bootstrapping = true;
    this.syncFeedStatus();

    if (this.timeline_rendered) {
      this._timeline_bootstrapping = false;
      this.syncFeedStatus();
      return;
    }

    this.appendTimelineBatch();
    this.timeline_rendered = true;
    this._timeline_bootstrapping = false;
    this.syncFeedStatus();

    this.fetchRemoteTransactions('tweets', 'newer');
  }

  paintThread() {
    const container = `${this.container} .list[data-panel="thread"]`;

    this.clearPanel(container);
    this.renderThreadContextLink(container);
    this.appendThreadBatch();
    this.syncFeedStatus();
  }

  renderThreadContextLink(container) {
    const focused = this.mod.getTweet(this.active_signature);

    if (!focused?.parent_id) {
      return;
    }

    const parent = this.mod.getTweet(focused.parent_id);

    if (!parent) {
      return;
    }

    const root = this.getThreadRoot(this.active_signature);
    const html = `
      <div class="thread-context" role="button" tabindex="0" data-root="${root}">
        View entire thread
      </div>
    `;

    this.app.browser.addElementToSelector(html, container);
  }

  paintNotifications() {
    if (this.notifications_rendered || this._notifications_bootstrapping) {
      this.syncFeedStatus();
      return;
    }

    this.bootstrapNotifications();
  }

  async bootstrapNotifications() {
    if (this.notifications_rendered || this._notifications_bootstrapping) {
      return;
    }

    this._notifications_bootstrapping = true;
    this.syncFeedStatus();

    this.appendNotificationsBatch();

    await this.loadNotificationDirection('newer');

    if (this.getRenderedItemCount() === 0) {
      await this.loadNotificationDirection('older');
    }

    this.notifications_rendered = true;
    this._notifications_bootstrapping = false;

    const state = this.pagination.notifications;

    if (this.getRenderedItemCount() === 0) {
      state.loading = false;
      state.exhausted = true;
    }

    this.syncFeedStatus();
  }

  loadNotificationDirection(direction) {
    return new Promise((resolve) => {
      let settled = false;

      const finish = (result) => {
        if (settled) {
          return;
        }

        settled = true;

        if (direction === 'newer') {
          this.handleNewerNotifications(
            result || {
              type: 'notifications',
              direction: 'newer',
              added: [],
              updated: [],
              ignored: [],
              exhausted: true
            }
          );
        } else {
          this.applyOlderLoadResult(
            result || {
              type: 'notifications',
              direction: 'older',
              added: [],
              updated: [],
              ignored: [],
              exhausted: true
            }
          );
        }

        resolve();
      };

      const timer = setTimeout(() => {
        finish({
          type: 'notifications',
          direction,
          added: [],
          updated: [],
          ignored: [],
          exhausted: true
        });
      }, 12000);

      try {
        this.mod.loadTransactions('notifications', direction, (result) => {
          clearTimeout(timer);
          finish(result);
        });
      } catch (err) {
        clearTimeout(timer);
        finish({
          type: 'notifications',
          direction,
          added: [],
          updated: [],
          ignored: [],
          exhausted: true
        });
      }
    });
  }

  paintProfileView() {
    const container = this.getActivePanelSelector();

    this.clearPanel(container);

    const tweets = this.collectProfileTweets();

    for (const tweet of tweets) {
      tweet.render(container);
    }

    // Local profile views are a completed load — no contradictory empty+end.
    const state = this.getPaginationState();
    state.loading = false;
    state.exhausted = true;
    this.syncFeedStatus();
  }

  collectProfileTweets() {
    const key = this.active_profile_key || '';
    const tweets = Object.values(this.mod.tweets || {});

    let filtered = tweets;

    if (this.mode === 'posts') {
      filtered = tweets.filter((tweet) => (!key || tweet.publicKey === key) && !tweet.parent_id);
    } else if (this.mode === 'replies') {
      filtered = tweets.filter(
        (tweet) => (!key || tweet.publicKey === key) && Boolean(tweet.parent_id)
      );
    } else if (this.mode === 'likes') {
      filtered = tweets.filter((tweet) => {
        const likers = tweet.tx?.optional?.likers;

        if (Array.isArray(likers) && key) {
          return likers.includes(key);
        }

        return false;
      });
    }

    return filtered.sort((a, b) => {
      const tsA = Number(a.updated_at) || Number(a.created_at) || Number(a.tx?.timestamp) || 0;
      const tsB = Number(b.updated_at) || Number(b.created_at) || Number(b.tx?.timestamp) || 0;
      return tsB - tsA;
    });
  }

  appendTimelineBatch() {
    const state = this.pagination.timeline;
    const signatures = this.mod.tweets_timeline.slice(state.cursor, state.cursor + state.batchSize);
    const container = this.getActivePanelSelector();

    if (signatures.length === 0) {
      this.syncFeedStatus();
      return 0;
    }

    for (const signature of signatures) {
      const tweet = this.mod.getTweet(signature);

      if (tweet) {
        this.renderTweetWithCriticalChild(tweet, container);
      }
    }

    state.cursor += signatures.length;

    this.syncFeedStatus();

    return signatures.length;
  }

  appendNotificationsBatch() {
    const state = this.pagination.notifications;
    const signatures = this.mod.notifications_timeline.slice(
      state.cursor,
      state.cursor + state.batchSize
    );
    const container = this.getActivePanelSelector();

    if (signatures.length === 0) {
      this.syncFeedStatus();
      return 0;
    }

    for (const signature of signatures) {
      const notification = this.mod.getNotification(signature);

      if (notification) {
        notification.render(container);
      }
    }

    state.cursor += signatures.length;

    this.syncFeedStatus();

    return signatures.length;
  }

  appendThreadBatch() {
    const state = this.pagination.thread;
    const signatures = state.chain.slice(state.cursor, state.cursor + state.batchSize);
    const container = this.getActivePanelSelector();

    if (signatures.length === 0) {
      if (state.cursor >= state.chain.length) {
        state.exhausted = true;
      }

      this.syncFeedStatus();
      return 0;
    }

    for (let i = 0; i < signatures.length; i++) {
      const signature = signatures[i];
      const tweet = this.mod.getTweet(signature);
      const globalIndex = state.cursor + i;

      if (!tweet) {
        continue;
      }

      const options = this.buildThreadRenderOptions(globalIndex, state.chain.length);
      tweet.render(container, options);
    }

    state.cursor += signatures.length;

    if (state.cursor >= state.chain.length) {
      state.exhausted = true;
    }

    this.syncFeedStatus();

    return signatures.length;
  }

  buildThreadRenderOptions(globalIndex, chainLength) {
    const options = {};

    if (globalIndex === 0) {
      options.focused = true;
      options.presentation = 'focused';
    } else {
      options.reply = true;
      options.presentation = 'reply';
      options.chainPrev = true;
    }

    if (globalIndex < chainLength - 1) {
      options.chainNext = true;
      options.chainContinue = true;
    }

    return options;
  }

  appendLoadedItems(result) {
    const container = this.getActivePanelSelector();
    const state = this.getPaginationState();
    const signatures = result.added || [];

    if (this.mode === 'notifications') {
      for (const signature of signatures) {
        const notification = this.mod.getNotification(signature);

        if (notification) {
          notification.render(container);
        }
      }

      state.cursor += signatures.length;
      return;
    }

    if (this.mode === 'thread') {
      const startIndex = state.cursor;

      for (let i = 0; i < signatures.length; i++) {
        const signature = signatures[i];
        const tweet = this.mod.getTweet(signature);
        const globalIndex = startIndex + i;

        if (!tweet) {
          continue;
        }

        tweet.render(container, this.buildThreadRenderOptions(globalIndex, state.chain.length));
      }

      state.cursor += signatures.length;
      return;
    }

    for (const signature of signatures) {
      const tweet = this.mod.getTweet(signature);

      if (!tweet || tweet.parent_id) {
        continue;
      }

      this.renderTweetWithCriticalChild(tweet, container);
    }

    state.cursor += signatures.length;
  }

  resetThreadPagination(signature) {
    this.pagination.thread = {
      ...this.createPaginationState().thread,
      chain: this.buildThreadView(signature)
    };
  }

  buildThreadView(signature) {
    if (!signature) {
      return [];
    }

    return [signature, ...this.getDirectReplies(signature)];
  }

  getDirectReplies(parentSignature) {
    const children = this.mod.tweets_children[parentSignature] || [];

    return children
      .map((sig) => this.mod.getTweet(sig))
      .filter(Boolean)
      .sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
      .map((tweet) => tweet.signature);
  }

  getThreadRoot(signature) {
    let root = signature;

    while (this.mod.tweets_parents[root]) {
      root = this.mod.tweets_parents[root];
    }

    return root;
  }

  //
  // Compose integration — Manager owns all post-submit rendering
  //

  onTweetPosted(tweet) {
    if (!tweet) {
      return;
    }

    const isReply = Boolean(tweet.parent_id);

    if (this.mode === 'thread' && isReply && tweet.parent_id === this.active_signature) {
      this.insertThreadReply(tweet);
      return;
    }

    if (this.mode !== 'timeline') {
      if (isReply) {
        this.openThreadForPostedReply(tweet);
        return;
      }

      this.renderTimelineForNewPost();
    }

    if (!isReply) {
      this.insertTimelineTweet(tweet);
    }
  }

  renderTimelineForNewPost() {
    this.saveScrollPosition();
    this.mode = 'timeline';
    this.active_signature = '';
    this.active_profile_key = '';
    this.scroll_positions.timeline = 0;
    this.updateModeVisibility();
    this.syncFeedHeader();
    this.resetMenuToHome();
    this.syncProfileNav();

    if (!this.timeline_rendered) {
      this.paintTimeline();
    }

    this.syncScrollFooter();

    requestAnimationFrame(() => {
      const scroller = this.getScrollContainer();

      if (scroller) {
        scroller.scrollTop = 0;
      }
    });
  }

  openThreadForPostedReply(tweet) {
    if (!tweet) {
      return;
    }

    this.renderThread(tweet.signature);
  }

  insertTimelineTweet(tweet) {
    if (!tweet || tweet.parent_id) {
      return;
    }

    const container = `${this.container} .list[data-panel="timeline"]`;
    const panel = document.querySelector(container);

    if (!panel) {
      return;
    }

    const child = tweet.critical_child ? this.mod.getTweet(tweet.critical_child) : null;
    const options = {};

    if (child) {
      options.chainNext = true;
      options.chainContinue = true;
      options.presentation = 'root';
      options.root = true;
    }

    const html = TweetTemplate(tweet, tweet.buildClassName(options), options);
    this.app.browser.prependElementToSelector(html, container);

    this.pagination.timeline.cursor += 1;
    this.timeline_rendered = true;

    if (child) {
      const childOptions = { chainPrev: true, presentation: 'reply', reply: true };
      const childHtml = TweetTemplate(child, child.buildClassName(childOptions), childOptions);
      const parentEl = panel.querySelector(`article.tweet[data-id="${tweet.signature}"]`);

      if (parentEl) {
        parentEl.insertAdjacentHTML('afterend', childHtml);
      }
    }

    const element = panel.querySelector(`article.tweet[data-id="${tweet.signature}"]`);
    this.animateTweetInsertion(element);
  }

  insertThreadReply(tweet) {
    if (!tweet || tweet.parent_id !== this.active_signature) {
      return;
    }

    const container = `${this.container} .list[data-panel="thread"]`;
    const panel = document.querySelector(container);

    if (!panel) {
      return;
    }

    const options = { chainPrev: true, presentation: 'reply', reply: true };
    const html = TweetTemplate(tweet, tweet.buildClassName(options), options);
    const focusedEl = panel.querySelector(`article.tweet[data-id="${this.active_signature}"]`);
    const replies = panel.querySelectorAll(
      `article.tweet:not([data-id="${this.active_signature}"])`
    );
    const lastReply = replies.length ? replies[replies.length - 1] : null;
    const anchor = lastReply || focusedEl;

    if (lastReply) {
      lastReply.classList.add('chain-next', 'chain-continue');
    } else if (focusedEl) {
      focusedEl.classList.add('chain-next', 'chain-continue');
    }

    if (anchor) {
      anchor.insertAdjacentHTML('afterend', html);
    } else {
      this.app.browser.addElementToSelector(html, container);
    }

    if (!this.pagination.thread.chain.includes(tweet.signature)) {
      this.pagination.thread.chain.push(tweet.signature);
    }

    this.pagination.thread.cursor += 1;

    const element = panel.querySelector(`article.tweet[data-id="${tweet.signature}"]`);
    this.animateTweetInsertion(element);
  }

  animateTweetInsertion(element) {
    if (!element) {
      return;
    }

    element.classList.add('enter');

    const onEnd = () => {
      element.classList.remove('enter');
      element.removeEventListener('animationend', onEnd);
    };

    element.addEventListener('animationend', onEnd);
  }

  renderTweetWithCriticalChild(tweet, container, options = {}) {
    this.renderTweetChain(tweet, container, options, false);
  }

  renderCriticalChildChain(tweet, container, options = {}) {
    this.renderTweetChain(tweet, container, options, true);
  }

  renderTweetChain(tweet, container, options = {}, followFullChain = false) {
    if (!tweet) {
      return;
    }

    const child = tweet.critical_child ? this.mod.getTweet(tweet.critical_child) : null;
    const renderOptions = { ...options };

    if (child) {
      renderOptions.chainNext = true;
      renderOptions.chainContinue = true;
      // Parent of a critical-child stub reads as conversation root.
      if (!renderOptions.presentation && !renderOptions.focused) {
        renderOptions.presentation = 'root';
        renderOptions.root = true;
      }
    }

    tweet.render(container, renderOptions);

    if (!child) {
      return;
    }

    const childOptions = {
      chainPrev: true,
      presentation: 'reply',
      reply: true
    };

    if (followFullChain) {
      this.renderTweetChain(child, container, childOptions, true);
      return;
    }

    child.render(container, childOptions);
  }

  attachEvents() {
    const root = document.querySelector(this.container);

    if (!root) {
      return;
    }

    this.attachTweetNavigation(root);
    this.attachThreadContext(root);
    this.attachTweetMenu(root);
    this.attachTweetReply(root);
    this.attachTweetLike(root);
    this.attachTweetRetweet(root);
    this.attachFeedHeaderBack(root);
    this.attachScrollEvents();
    this.attachViewportChrome();
  }

  attachViewportChrome() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    if (this._viewportChromeBound) {
      return;
    }

    this._viewportChromeBound = true;
    this._compactViewportQuery = window.matchMedia('(max-width: 600px)');

    const onChange = () => {
      this.syncFeedHeader();
    };

    if (typeof this._compactViewportQuery.addEventListener === 'function') {
      this._compactViewportQuery.addEventListener('change', onChange);
    } else if (typeof this._compactViewportQuery.addListener === 'function') {
      this._compactViewportQuery.addListener(onChange);
    }
  }

  attachFeedHeaderBack(root) {
    if (!root || root.dataset.feedHeaderBackBound === '1') {
      return;
    }

    root.dataset.feedHeaderBackBound = '1';

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('.back');

      if (!btn || !root.contains(btn) || btn.hidden) {
        return;
      }

      e.preventDefault();
      this.navigateBackToTimeline();
    });
  }

  attachThreadContext(root) {
    if (!root || root.dataset.threadContextBound === '1') {
      return;
    }

    root.dataset.threadContextBound = '1';

    root.addEventListener('click', (e) => {
      const link = e.target.closest('.thread-context');

      if (!link) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const rootSignature = link.getAttribute('data-root') || '';

      if (rootSignature) {
        this.renderThread(rootSignature);
      }
    });
  }

  attachTweetReply(root) {
    if (!root || root.dataset.tweetReplyBound === '1') {
      return;
    }

    root.dataset.tweetReplyBound = '1';

    root.addEventListener('click', (e) => {
      const replyButton = e.target.closest('.tool.comment');

      if (!replyButton) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const tweetArticle = replyButton.closest('article.tweet');
      const signature = tweetArticle?.getAttribute('data-id') || '';
      const tweet = this.mod.getTweet(signature);

      if (tweet) {
        this.mod.compose_overlay?.open({ reply_to: tweet, mode: 'reply' });
      }
    });
  }

  attachTweetLike(root) {
    if (!root || root.dataset.tweetLikeBound === '1') {
      return;
    }

    root.dataset.tweetLikeBound = '1';

    root.addEventListener('click', async (e) => {
      const likeButton = e.target.closest('.tool.like');

      if (!likeButton) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const tweetArticle = likeButton.closest('article.tweet');
      const signature = tweetArticle?.getAttribute('data-id') || '';
      const tweet = this.mod.getTweet(signature);

      if (!tweet?.signature) {
        return;
      }

      const keys = [];

      if (tweet.publicKey) {
        keys.push(tweet.publicKey);
      }

      if (tweet.tx?.to) {
        for (const slip of tweet.tx.to) {
          const publicKey = slip?.publicKey;

          if (publicKey && !keys.includes(publicKey)) {
            keys.push(publicKey);
          }
        }
      }

      try {
        const unsigned = await this.mod.createLikeTweetTransaction(
          { signature: tweet.signature },
          keys
        );
        await unsigned.sign();
        await this.app.network.propagateTransaction(unsigned);
        await this.mod.receiveLikeTweetTransaction(unsigned);
      } catch (err) {
        console.error('RedSquare like failed:', err);
        siteMessage('Unable to like tweet', 2500);
      }
    });
  }

  attachTweetRetweet(root) {
    if (!root || root.dataset.tweetRetweetBound === '1') {
      return;
    }

    root.dataset.tweetRetweetBound = '1';

    root.addEventListener('click', (e) => {
      const retweetButton = e.target.closest('.tool.retweet');

      if (!retweetButton) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const tweetArticle = retweetButton.closest('article.tweet');
      const signature = tweetArticle?.getAttribute('data-id') || '';
      const tweet = this.mod.getTweet(signature);

      if (tweet) {
        this.mod.compose_overlay?.open({ mode: 'retweet', retweet_of: tweet });
      }
    });
  }

  attachTweetMenu(root) {
    if (!root || root.dataset.tweetMenuBound === '1') {
      return;
    }

    root.dataset.tweetMenuBound = '1';

    root.addEventListener('click', (e) => {
      const moreButton = e.target.closest('.tool.more');

      if (!moreButton) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const tweetArticle = moreButton.closest('article.tweet');

      if (!tweetArticle) {
        return;
      }

      const signature = tweetArticle.getAttribute('data-id') || '';

      if (!signature) {
        return;
      }

      const tweet = this.mod.getTweet(signature);

      if (!tweet) {
        return;
      }

      this.mod.tweet_menu?.toggle({ anchor: moreButton, tweet });
    });
  }

  attachTweetNavigation(root) {
    if (!root || root.dataset.tweetNavigationBound === '1') {
      return;
    }

    root.dataset.tweetNavigationBound = '1';

    root.addEventListener('click', (e) => {
      const signature = Manager.resolveClickedSignature(e.target);

      if (!signature) {
        return;
      }

      this.renderThread(signature);
    });
  }

  attachScrollEvents() {
    if (this.scroll_bound) {
      return;
    }

    const scroller = this.getScrollContainer();

    if (!scroller) {
      return;
    }

    this.scroll_bound = true;

    scroller.addEventListener(
      'scroll',
      () => {
        if (this.scroll_raf) {
          return;
        }

        this.scroll_raf = requestAnimationFrame(() => {
          this.scroll_raf = null;
          this.onScroll();
        });
      },
      { passive: true }
    );
  }

  onScroll() {
    if (!this.isNearBottom()) {
      return;
    }

    this.loadMoreIfNeeded();
  }

  isNearBottom() {
    const scroller = this.getScrollContainer();

    if (!scroller) {
      return false;
    }

    const remaining = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;

    return remaining <= SCROLL_THRESHOLD_PX;
  }

  isNearTop() {
    const scroller = this.getScrollContainer();

    if (!scroller) {
      return true;
    }

    return scroller.scrollTop <= SCROLL_THRESHOLD_PX;
  }

  fetchRemoteTransactions(type, direction) {
    this.mod.loadTransactions(type, direction, (result) => {
      const payload = result || {
        type,
        direction,
        added: [],
        updated: [],
        ignored: [],
        exhausted: true
      };

      if (direction === 'newer') {
        this.onNewerContentLoaded(payload);
      }
    });
  }

  onPeersUpdated() {
    if (this.mode === 'timeline' && this.timeline_rendered) {
      this.fetchRemoteTransactions('tweets', 'newer');
    }
  }

  onNewerContentLoaded(result) {
    if (!result) {
      return;
    }

    if (result.type === 'tweets') {
      this.handleNewerTweets(result);
      return;
    }

    if (result.type === 'notifications' && this.mode === 'notifications') {
      this.handleNewerNotifications(result);
    }
  }

  canAutoInsertTimeline() {
    if (this.mode !== 'timeline' || !this.timeline_rendered) {
      return false;
    }

    if (!this.isNearTop()) {
      return false;
    }

    return !this.isUserInteractionBlocking();
  }

  isUserInteractionBlocking() {
    if (this.mod.compose_overlay?.getRoot?.()) {
      return true;
    }

    if (this.mod.tweet_menu?.isOpen) {
      return true;
    }

    if (this.mod.settings_overlay?.getRoot?.()) {
      return true;
    }

    return false;
  }

  handleNewerTweets(result) {
    if (!result?.added?.length) {
      return;
    }

    for (const signature of result.added) {
      if (!this.pending_newer_tweets.includes(signature)) {
        this.pending_newer_tweets.push(signature);
      }
    }

    if (this.canAutoInsertTimeline()) {
      this.flushPendingNewerTweets({ scrollToTop: false });
      return;
    }

    if (this.mode === 'timeline') {
      this.showNewPostsBanner();
    }
  }

  syncPendingNewerTweets() {
    if (!this.pending_newer_tweets.length) {
      this.hideNewPostsBanner();
      return;
    }

    if (this.canAutoInsertTimeline()) {
      this.flushPendingNewerTweets({ scrollToTop: false });
      return;
    }

    if (this.mode === 'timeline') {
      this.showNewPostsBanner();
    }
  }

  handleNewerNotifications(result) {
    if (!result?.added?.length) {
      return;
    }

    this.prependNotifications(result.added);
    this.pagination.notifications.exhausted = false;
    this.syncFeedStatus();
  }

  prependTimelineTweets(signatures) {
    const container = `${this.container} .list[data-panel="timeline"]`;
    const panel = document.querySelector(container);

    if (!panel || !signatures?.length) {
      return;
    }

    const tweets = signatures
      .map((signature) => this.mod.getTweet(signature))
      .filter((tweet) => tweet && !tweet.parent_id)
      .sort((a, b) => (a.created_at || 0) - (b.created_at || 0));

    for (const tweet of tweets) {
      const child = tweet.critical_child ? this.mod.getTweet(tweet.critical_child) : null;
      const options = {};

      if (child) {
        options.chainNext = true;
        options.chainContinue = true;
        options.presentation = 'root';
        options.root = true;
      }

      const html = TweetTemplate(tweet, tweet.buildClassName(options), options);
      this.app.browser.prependElementToSelector(html, container);

      if (child) {
        const childOptions = { chainPrev: true, presentation: 'reply', reply: true };
        const childHtml = TweetTemplate(child, child.buildClassName(childOptions), childOptions);
        const parentEl = panel.querySelector(`article.tweet[data-id="${tweet.signature}"]`);

        if (parentEl) {
          parentEl.insertAdjacentHTML('afterend', childHtml);
        }
      }
    }

    this.pagination.timeline.cursor += signatures.length;
    this.timeline_rendered = true;
  }

  prependNotifications(signatures) {
    const container = `${this.container} .list[data-panel="notifications"]`;
    const panel = document.querySelector(container);

    if (!panel || !signatures?.length) {
      return;
    }

    const notifications = signatures
      .map((signature) => this.mod.getNotification(signature))
      .filter(Boolean)
      .sort((a, b) => (a.created_at || 0) - (b.created_at || 0));

    for (const notification of notifications) {
      const html = notification.renderHTML();

      if (html) {
        this.app.browser.prependElementToSelector(html, container);
      }
    }

    this.pagination.notifications.cursor += signatures.length;
    this.notifications_rendered = true;
  }

  showNewPostsBanner() {
    if (!this.pending_newer_tweets.length || this.mode !== 'timeline') {
      return;
    }

    const root = document.querySelector(this.container);

    if (!root) {
      return;
    }

    let banner = root.querySelector('.new-posts-banner');

    if (!banner) {
      const body = root.querySelector('.body');
      const host = body?.parentElement || root;

      banner = document.createElement('button');
      banner.className = 'new-posts-banner';
      banner.type = 'button';
      banner.textContent = 'New posts available';
      banner.addEventListener('click', () => {
        this.revealPendingNewerTweets();
      });

      if (body && host) {
        host.insertBefore(banner, body);
      } else {
        host.prepend(banner);
      }
    }

    banner.hidden = false;
  }

  hideNewPostsBanner() {
    const banner = document.querySelector(`${this.container} .new-posts-banner`);

    if (!banner) {
      return;
    }

    banner.hidden = true;
  }

  revealPendingNewerTweets() {
    this.flushPendingNewerTweets({ scrollToTop: true });
  }

  flushPendingNewerTweets({ scrollToTop = false } = {}) {
    const signatures = this.pending_newer_tweets.slice();
    this.pending_newer_tweets = [];
    this.hideNewPostsBanner();

    if (!signatures.length) {
      return;
    }

    this.prependTimelineTweets(signatures);
    this.pagination.timeline.exhausted = false;
    this.syncFeedStatus();

    if (scrollToTop) {
      requestAnimationFrame(() => {
        const scroller = this.getScrollContainer();

        if (scroller) {
          scroller.scrollTop = 0;
        }
      });
    }
  }

  sliceUnrendered(signatures, cursor, batchSize) {
    if (cursor >= signatures.length) {
      return [];
    }

    return signatures.slice(cursor, cursor + batchSize);
  }

  loadMoreIfNeeded() {
    const state = this.getPaginationState();

    if (
      state.loading ||
      state.exhausted ||
      this.isProfileMode() ||
      this._notifications_bootstrapping ||
      this._timeline_bootstrapping
    ) {
      return;
    }

    this.loadMore();
  }

  async loadMore() {
    const state = this.getPaginationState();

    if (
      state.loading ||
      state.exhausted ||
      this.isProfileMode() ||
      this._notifications_bootstrapping ||
      this._timeline_bootstrapping
    ) {
      return;
    }

    state.loading = true;
    this.syncFeedStatus();

    let continueLoading = false;

    try {
      if (this.mode === 'thread') {
        const result = await ManagerLoadMore.loadMore({
          mode: this.mode,
          mod: this.mod,
          pagination: this.pagination,
          active_thread_id: this.active_thread_id,
          active_signature: this.active_signature
        });

        continueLoading = this.applyOlderLoadResult(result);
        return;
      }

      const type = this.mode === 'notifications' ? 'notifications' : 'tweets';
      const timeline =
        type === 'notifications' ? this.mod.notifications_timeline : this.mod.tweets_timeline;
      const pending = this.sliceUnrendered(timeline, state.cursor, state.batchSize);

      if (pending.length > 0) {
        continueLoading = this.applyOlderLoadResult({
          type,
          direction: 'older',
          added: pending.slice(),
          updated: [],
          ignored: [],
          exhausted: false
        });
        return;
      }

      await new Promise((resolve) => {
        let settled = false;

        const finish = (result) => {
          if (settled) {
            return;
          }

          settled = true;
          continueLoading = this.applyOlderLoadResult(
            result || {
              type,
              direction: 'older',
              added: [],
              updated: [],
              ignored: [],
              exhausted: true
            }
          );
          resolve();
        };

        const timer = setTimeout(() => {
          finish({
            type,
            direction: 'older',
            added: [],
            updated: [],
            ignored: [],
            exhausted: true
          });
        }, 12000);

        try {
          this.mod.loadTransactions(type, 'older', (result) => {
            clearTimeout(timer);
            finish(result);
          });
        } catch (err) {
          clearTimeout(timer);
          finish({
            type,
            direction: 'older',
            added: [],
            updated: [],
            ignored: [],
            exhausted: true
          });
        }
      });
    } finally {
      state.loading = false;
      this.syncFeedStatus();
    }

    if (continueLoading) {
      this.loadMoreIfNeeded();
    }
  }

  applyOlderLoadResult(result) {
    const state = this.getPaginationState();

    if (result.added?.length) {
      this.appendLoadedItems(result);
      this.syncFeedStatus();
      return this.isNearBottom();
    }

    // Empty older page — stop. Near-bottom empty feeds would otherwise refetch forever.
    state.exhausted = true;
    this.syncFeedStatus();
    return false;
  }

  ensureScrollFooter() {
    return this.ensureFeedStatus();
  }

  ensureFeedStatus() {
    const panel = this.getActivePanelElement();

    if (!panel) {
      return null;
    }

    let footer = panel.querySelector('.feed-status');

    // Upgrade leftover terminators from earlier builds.
    if (!footer) {
      panel.querySelectorAll('.feed-end, .scroll-footer').forEach((node) => node.remove());

      this.app.browser.addElementToElement(ManagerScrollFooterTemplate(), panel);
      footer = panel.querySelector('.feed-status');
    }

    if (footer && footer.parentNode === panel) {
      panel.appendChild(footer);
    }

    return footer;
  }

  getRenderedItemCount() {
    const panel = this.getActivePanelElement();

    if (!panel) {
      return 0;
    }

    return panel.querySelectorAll('article.tweet, article.notification').length;
  }

  hasCompletedInitialLoad() {
    if (this.isProfileMode()) {
      return true;
    }

    if (this.mode === 'timeline') {
      return this.timeline_rendered && !this._timeline_bootstrapping;
    }

    if (this.mode === 'notifications') {
      return this.notifications_rendered && !this._notifications_bootstrapping;
    }

    if (this.mode === 'thread') {
      return true;
    }

    return true;
  }

  /**
   * Mutually exclusive feed UI status:
   * loading | content | empty | end
   */
  resolveFeedStatus() {
    const state = this.getPaginationState();

    if (state.loading || this._timeline_bootstrapping || this._notifications_bootstrapping) {
      return 'loading';
    }

    const count = this.getRenderedItemCount();

    if (count === 0) {
      if (!this.hasCompletedInitialLoad()) {
        return 'loading';
      }

      return 'empty';
    }

    if (state.exhausted) {
      return 'end';
    }

    return 'content';
  }

  syncFeedStatus() {
    const footer = this.ensureFeedStatus();

    if (!footer) {
      return;
    }

    const status = this.resolveFeedStatus();
    footer.dataset.status = status;

    const message = footer.querySelector('.message');

    if (message) {
      // Loading is spinner-only — never keep empty/end copy under the loader.
      message.textContent =
        status === 'loading' || status === 'content' ? '' : this.getFeedStatusMessage(status);
    }
  }

  showScrollFooter() {
    this.syncFeedStatus();
  }

  hideScrollFooter() {
    this.syncFeedStatus();
  }

  syncScrollFooter() {
    this.syncFeedStatus();
  }

  static isTweetActionTarget(element) {
    if (!element || typeof element.closest !== 'function') {
      return false;
    }

    return Boolean(element.closest('.controls, .show-more, .tool'));
  }

  static resolveClickedSignature(element) {
    if (!element || typeof element.closest !== 'function') {
      return '';
    }

    if (Manager.isTweetActionTarget(element)) {
      return '';
    }

    const tweet = element.closest('article.tweet');

    if (tweet) {
      return tweet.getAttribute('data-id') || '';
    }

    const notification = element.closest('article.notification');

    if (notification) {
      return notification.getAttribute('data-tweet-id') || '';
    }

    return '';
  }
}

module.exports = Manager;
