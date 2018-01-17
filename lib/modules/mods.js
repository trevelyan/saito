


function Mods(app) {

  if (!(this instanceof Mods)) {
    return new Mods(app);
  }

  this.app     = app;
  this.mods    = [];   // array of objects

  return this;

}
module.exports = Mods



////////////////////////
// Initialize Modules //
////////////////////////
Mods.prototype.pre_initialize = function pre_initialize() {

  /////////////////////////
  // Insert Modules Here //
  /////////////////////////
  this.mods.push(require('./mods/advert/advert')(this.app));
  this.mods.push(require('./mods/faucet/faucet')(this.app));
  this.mods.push(require('./mods/explorer/explorer')(this.app));
  //
  // email-mobile precedes email
  //
  //this.mods.push(require('./mods/bank/bank')(this.app));
  //this.mods.push(require('./mods/debug/debug')(this.app));
  this.mods.push(require('./mods/email-mobile/email-mobile')(this.app));
  this.mods.push(require('./mods/email/email')(this.app));
  this.mods.push(require('./mods/encrypt/encrypt')(this.app));
  this.mods.push(require('./mods/facebook/facebook')(this.app));
  this.mods.push(require('./mods/registry/registry')(this.app));
  this.mods.push(require('./mods/reddit/reddit')(this.app));
  this.mods.push(require('./mods/mempool/mempool')(this.app));


  //this.mods.push(require('./mods/spammer/spammer')(this.app));
  //this.mods.push(require('./mods/archive/archive')(this.app));
  //this.mods.push(require('./mods/payment/payment')(this.app));
  //this.mods.push(require('./mods/secret/secret')(this.app));
  //this.mods.push(require('./mods/banker/banker')(this.app));
  //this.mods.push(require('./mods/money/money')(this.app));
  //this.mods.push(require('./mods/auth/auth')(this.app));
  //this.mods.push(require('./mods/subscription/subscription')(this.app));
  //this.mods.push(require('./mods/localstorage/localstorage')(this.app));
  //this.mods.push(require('./mods/server/server')(this.app));
  //this.mods.push(require('./mods/invite/invite')(this.app));
  //this.mods.push(require('./mods/ping/ping')(this.app));

  if (this.app.options.modules == null) { this.app.options.modules = []; }
  for (i = 0; i < this.mods.length; i++) {
    mi = 0;
    for (j = 0; j < this.app.options.modules.length; j++) { if (this.mods[i].name == this.app.options.modules[j]) { mi = 1; }}
    if (mi == 0) { this.mods[i].installModule(this.app); };;
  }

}
Mods.prototype.initialize = function initialize() {
  for (i = 0; i < this.mods.length; i++) {
    this.mods[i].initialize(this.app);
  }
}
Mods.prototype.returnModule = function returnModule(modname) {
  for (i = 0; i < this.mods.length; i++) {
    if (modname == this.mods[i].name) {
      return this.mods[i];
    }
  }
  return null;
}
Mods.prototype.affixCallbacks = function affixCallbacks(txindex, message, callbackArray, callbackIndexArray) {
  for (i = 0; i < this.mods.length; i++) {
    if (this.mods[i].shouldAffixCallbackToModule(message.module) == 1) {
     callbackArray.push(this.mods[i].onConfirmation);
      callbackIndexArray.push(txindex);
    }
  }
}
Mods.prototype.displayEmailForm = function displayEmailForm(modname) {
  for (i = 0; i < this.mods.length; i++) {
    if (modname == this.mods[i].name) {
      if (this.mods[i].handlesEmail == 1) {
        this.mods[i].displayEmailForm(this.app);
      }
    }
  }
  return null;
}
Mods.prototype.displayEmailMessage = function displayEmailMessage(message_id, modname) {
  for (i = 0; i < this.mods.length; i++) {
    if (modname == this.mods[i].name) {
      if (this.mods[i].handlesEmail == 1) {
        return this.mods[i].displayEmailMessage(message_id, this.app);
      }
    }
  }
  return null;
}
Mods.prototype.attachEvents = function attachEvents() {
  for (imp = 0; imp < this.mods.length; imp++) {
    if (this.mods[imp].browser_active == 1) {
      this.mods[imp].attachEvents(this.app);
    }
  }
  return null;
}
Mods.prototype.attachEmailEvents = function attachEmailEvents() {
  for (imp = 0; imp < this.mods.length; imp++) {
    this.mods[imp].attachEmailEvents(this.app);
  }
  return null;
}
Mods.prototype.initializeHTML = function initializeHTML() {
  for (icb = 0; icb < this.mods.length; icb++) {
    if (this.mods[icb].browser_active == 1) {
      this.mods[icb].initializeHTML(this.app);
    }
  }
  return null;
}
Mods.prototype.formatEmailTransaction = function formatEmailTransaction(tx, modname) {
  for (i = 0; i < this.mods.length; i++) {
    if (modname == this.mods[i].name) {
      return this.mods[i].formatEmailTransaction(tx, this.app);
    }
  }
  return null;
}
Mods.prototype.webServer = function webServer(expressapp) {
  for (i = 0; i < this.mods.length; i++) {
    this.mods[i].webServer(this.app, expressapp);
  }
  return null;
}
Mods.prototype.updateBalance = function updateBalance() {
  for (i = 0; i < this.mods.length; i++) {
    this.mods[i].updateBalance(this.app);
  }
  return null;
}
Mods.prototype.handlePeerRequest = function handlePeerRequest(message, peer, mycallback=null) {
  for (iii = 0; iii < this.mods.length; iii++) {
    this.mods[iii].handlePeerRequest(this.app, message, peer, mycallback);
  }
  return;
}
Mods.prototype.handleDomainRequest = function handleDomainRequest(message, peer, mycallback) {
  for (iii = 0; iii < this.mods.length; iii++) {
    if (this.mods[iii].handlesDNS == 1) {
      this.mods[iii].handleDomainRequest(this.app, message, peer, mycallback);
    }
  }
  return;
}
Mods.prototype.loadFromArchives = function loadFromArchives(tx) {
  for (iii = 0; iii < this.mods.length; iii++) {
    this.mods[iii].loadFromArchives(this.app, tx);
  }
  return;
}
Mods.prototype.onNewBlock = function onNewBlock(blk) {
  for (iii = 0; iii < this.mods.length; iii++) {
    this.mods[iii].onNewBlock(blk);
  }
  return;
}
Mods.prototype.onChainReorganization = function onChainReorganization(block_id, block_hash, lc) {
  for (imp = 0; imp < this.mods.length; imp++) {
    this.mods[imp].onChainReorganization(block_id, block_hash, lc);
  }
  return null;
}







