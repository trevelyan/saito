


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
Mods.prototype.initialize = function initialize() {


  /////////////////////////
  // Insert Modules Here //
  /////////////////////////
  this.mods.push(require('./mods/archive/archive')(this.app));
  this.mods.push(require('./mods/email/email')(this.app));
  this.mods.push(require('./mods/registry/registry')(this.app));
  this.mods.push(require('./mods/auth/auth')(this.app));
  this.mods.push(require('./mods/facebook/facebook')(this.app));
  this.mods.push(require('./mods/encrypt/encrypt')(this.app));
  //this.mods.push(require('./mods/invite/invite')(this.app));
  //this.mods.push(require('./search/search')(this.app));
  //this.mods.push(require('./server/server')(this.app));
  //this.mods.push(require('./exchange/exchange')(this.app));
  //this.mods.push(require('./twitter/twitter')(this.app));
  //this.mods.push(require('./debug/debug')(this.app));
  //this.mods.push(require('./ping/ping')(this.app));
  //this.mods.push(require('./vpn/vpn')(this.app));



  // make sure our options object exists
  if (this.app.options.modules == null) {
    this.app.options.modules = [];
  }


  // install modules as needed
  for (i = 0; i < this.mods.length; i++) {
    module_installed = 0;
    for (j = 0; j < this.app.options.modules.length; j++) {
      if (this.mods[i].name == this.app.options.modules[j]) { module_installed = 1; }
    }
    if (module_installed == 0) {
      this.mods[i].installModule(this.app);
    };
  }


  // initialize modules as needed
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
Mods.prototype.handlePeerRequest = function handlePeerRequest(message, peer) {
  for (iii = 0; iii < this.mods.length; iii++) {
    this.mods[iii].handlePeerRequest(this.app, message, peer);
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
console.log("in modules class feeding transaction into module");
    this.mods[iii].loadFromArchives(this.app, tx);
  }
  return;
}







