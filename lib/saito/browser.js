var saito = require('../saito');




function Browser(app) {

  if (!(this instanceof Browser)) {
    return new Browser(app);
  }

  this.app = app || {};
  this.monitor_timer   = null;
  this.monitor_speed   = 5000;  // every second
}
module.exports = Browser;





Browser.prototype.initialize = function initialize() {

    browser_self = this;

    if (this.app.BROWSERIFY == 0) { return; }
 
    if (this.app.options.messages == null) { this.app.options.messages = []; }

    this.app.modules.initializeHTML();
    this.app.modules.attachEvents();


}





Browser.prototype.monitorBlockchainSyncing = function monitorBlockchainSyncing(remote_blkid, remote_genesis_blkid) {

  $( "#connections_sync" ).progressbar({ value: 100 });

  var local_block_id  = this.app.options.lastblock;

  if (local_block_id == remote_blkid) {
    return;
  }


  // the remote machine cannot sync from our 
  // current starting point because it has 
  // already adjusted its genesis block forward
  // so we treat its genesis block as our own
  // genesis block starting point.
  if (remote_genesis_blkid > local_block_id) {
    local_block_id = remote_genesis_blkid; 
  }

  var remote_block_id = remote_blkid;
  browser_self = this;

  this.monitor_timer = setInterval(function(){
    found = 1;
    while (found == 1 && local_block_id <= remote_block_id) {
      if (browser_self.app.blockchain.isBlockIdIndexed(local_block_id) == 1) { local_block_id++; }
      else {
        local_block_id--;
        found = 0;
      }
    }
    
    var percent_downloaded = 0;
    if (remote_block_id > 0) {
      percent_downloaded = Math.floor(( local_block_id / remote_block_id ) * 100);
    }

    $( "#connections_sync" ).progressbar({
      value: percent_downloaded
    });

    if (percent_downloaded == 100) {
      // ensure we update our options file
      browser_self.app.storage.saveOptions();
      clearInterval(browser_self.monitor_timer);
    }
  }, this.monitor_speed);

}



Browser.prototype.updateBalance = function updateBalance() {

  for (md = 0; md < this.app.modules.length; md++) {
    this.app.modules[md].updateBalance();
  }
}

