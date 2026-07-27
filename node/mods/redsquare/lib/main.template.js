module.exports = () => {
  return `
    <div class="sidebar-left hide-scrollbar"></div>

    <main class="main">
      <div class="manager" data-mobile-view="feed"></div>
      <section class="redsquare-mobile-view redsquare-mobile-chat" data-mobile-view="chat" hidden></section>
      <section class="redsquare-mobile-view redsquare-mobile-settings" data-mobile-view="settings" hidden></section>
    </main>

    <aside class="sidebar-right hide-scrollbar">
      <div class="redsquare-profile"></div>
      <div class="redsquare-create"></div>
      <div class="sidebar"></div>
    </aside>
  `;
};
