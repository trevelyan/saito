var saito = require('../saito');


function Archives(app, archivesjson="") {

  if (!(this instanceof Archives)) {
    return new Archives(app, archivesjson);
  }

  this.app                 = app || {};
  this.archives            = []; // {"host":"localhost","port":12101,"publickey":"", "active":"inactive", "type":"messages"}
  this.messages            = [];
  this.local_storage_limit = 40;

  if (archivesjson != "") {
    this.archives = JSON.parse(archivesjson);
  }

  return this;

}
module.exports = Archives;



Archives.prototype.addArchive = function addArchive(server_domain, server_port, server_publickey, active="inactive", archivetype="transactions") {
  var tmpx = {};
  tmpx.domain    = server_domain;
  tmpx.port      = server_port;
  tmpx.publickey = server_publickey;
  tmpx.active    = active;
  tmpx.type      = archivetype;
  for (var bvc = 0; bvc < this.archives.length; bvc++) {
    if (JSON.stringify(this.archives[bvc]) == JSON.stringify(tmpx)) { return; }
  }
  this.archives.push(tmpx);
}
Archives.prototype.containsMessageById = function containsMessageById(tx_id) {
  for (var amt = this.messages.length-1; amt >= 0; amt--) {
    if (this.messages[amt].transaction.id == tx_id) { return 1; }
  }
  return 0;
}
Archives.prototype.initialize = function initialize() {

  if (this.app.options.archives != null) {
    for (var i = 0; i < this.app.options.archives.length; i++) {
      this.archives[i] = this.app.options.archives[i];
    }
  }

  // add any archives to our peer list and connect as needed
  for (var vcm = 0; vcm < this.archives.length; vcm++) {
    // do not send blocks, transactions or tickets to any archive servers by default
    this.app.network.addPeer(this.archives[vcm].host, this.archives[vcm].port, 0, 0, 0);
  }

  // load content
  this.loadMessages();

}
Archives.prototype.loadMessages = function loadMessages(number = 50, offset = 0) {

  if (this.app.BROWSER == 1) {
    if (typeof(Storage) !== "undefined") {
      var data = localStorage.getItem("messages");
      this.messages = JSON.parse(data);
      if (this.messages == null) { 
	this.messages = []; 
      } 
    }
  }

  for (var s = 0; s < this.archives.length; s++) {
    for (var t = 0; t < this.app.network.peers.length; t++) {
      if (this.archives[s].host == this.app.network.peers[t].peer.host && this.archives[s].active == "active") {

        // send request for archived messages
        var userMessage = {};
            userMessage.request          = "archive load request";
            userMessage.data             = {};
            userMessage.data.number      = 50;
            userMessage.data.starting_at = 0;
            userMessage.data.publickey   = this.app.wallet.returnPublicKey();

        this.app.network.peers[t].sendRequest(userMessage.request, userMessage.data);
  
      }
    }
  }
}
Archives.prototype.processMessages = function processMessages(number, callback) {
  var tmpmsg = [];
  var starting_point = this.messages.length - number;  if (starting_point < 0) { starting_point = 0; }
  for (var n = starting_point; n < this.messages.length; n++) {
    tmpmsg[n] = this.messages[n];
  }
  var err    = {};
  callback(err, tmpmsg);
}
Archives.prototype.returnArchives = function returnArchives() {
  return this.archives;
}
Archives.prototype.returnArchivesJson = function returnArchivesJson() {
  return JSON.stringify(this.returnArchives());
}
Archives.prototype.returnTransactionById = function returnTransactionById(txid) {
  for (var mv = this.messages.length-1; mv >= 0; mv--) {
    if (this.messages[mv].transaction.id == txid) { return this.messages[mv]; }
  }
  return null;
}
Archives.prototype.removeMessage = function removeMessage(txid) {

  mytxid = txid;
  mytxts = 0;

  for (var n = this.messages.length-1; n >= 0; n--) {
    if (this.messages[n].transaction.id == txid) {
      var mytxts = this.messages[n].transaction.ts;
      this.messages.splice(n,1);
      n = this.messages.length;
      this.saveArchives();
    }
  }

  /////////////////////////////////
  // delete from backup services // (if connected)
  /////////////////////////////////
  for (var aas = 0; aas < this.archives.length; aas++) {
    if (this.archives[aas].active == "active") {
      
      var message             = {};
      message.request         = "archive delete request";
      message.data            = {};
      message.data.publickey  = this.app.wallet.returnPublicKey();
      message.data.txid       = mytxid;
      message.data.txts       = mytxts;
      message.data.auth       = this.app.crypt.signMessage("delete_"+mytxid, this.app.wallet.returnPrivateKey());
      message.data.unixtime   = tx.transaction.ts;

      for (var y = 0; y < this.app.network.peers.length; y++) {
        if (this.app.network.peers[y].peer.publickey = this.archives[aas].publickey) {
	  this.app.network.peers[y].sendRequest(message.request, message.data);
        }
      }
    }
  }
}
Archives.prototype.resetArchives = function resetArchives() {
  this.messages = [];
  if (this.app.BROWSER == 1) {
    if (typeof(Storage) !== "undefined") {
      localStorage.setItem("messages", JSON.stringify(this.messages));
    }
  }

  var message             = {};
  message.request         = "archive reset request";
  message.data            = {};
  message.data.publickey  = this.app.wallet.returnPublicKey();
  message.data.unixtime   = new Date().getTime();
console.log("HERE WE ARE: ");
console.log(message.data.publickey);
console.log(JSON.stringify(this.app.wallet.wallet, null, 4));

  message.data.auth       = this.app.crypt.signMessage("reset_"+message.data.unixtime, this.app.wallet.returnPrivateKey());

  for (var aas = 0; aas < this.archives.length; aas++) {
    if (this.archives[aas].active == "active") {
      for (var y = 0; y < this.app.network.peers.length; y++) {
        if (this.app.network.peers[y].peer.publickey = this.archives[aas].publickey) {
          this.app.network.peers[y].sendRequest(message.request, message.data);
        }
      }
    }
  }
}
Archives.prototype.saveArchives = function saveArchives() {
  if (this.app.BROWSER == 1) {
    if (typeof(Storage) !== "undefined") {
      localStorage.setItem("messages", JSON.stringify(this.messages));
    }
  }
  this.app.options.archives = this.returnArchives();
  this.app.storage.saveOptions();
}
Archives.prototype.saveMessage = function saveMessage(tx) {

  ///////////////////
  // Local Storage //
  ///////////////////
  if (this.app.BROWSER == 1) {
    if (typeof(Storage) !== "undefined") {

      // reload before saving
      var data = localStorage.getItem("messages");

      this.messages = JSON.parse(data);
      if (this.messages == null) {
	console.log("resetting Message array in Archives saveMessage");
	this.messages = [];
      }

      // do not add duplicates
      for (var mb = 0; mb < this.messages.length; mb++) {
	if (this.messages[mb].transaction.msig === tx.transaction.msig) { 
	  return; 
	}
      }
       
      // if we are at our local storage limit remove the
      // last email and add our new one to the top
      if (this.messages.length == this.local_storage_limit) {
        for (var mb = 0; mb < this.messages.length-1; mb++) {
	  this.messages[mb] = this.messages[mb+1];
        }
	this.messages[this.messages.length-1] = tx;
      } else {
        this.messages.push(tx);
      }
      localStorage.setItem("messages", JSON.stringify(this.messages));
    }
  }


  /////////////////////
  // backup services //
  /////////////////////
  for (var aas = 0; aas < this.archives.length; aas++) {
    if (this.archives[aas].active == "active") {
      
      var message                 = {};
      message.request         = "archive";
      message.data            = {};
      message.data.publickey  = this.app.wallet.returnPublicKey();
      message.data.tx         = JSON.stringify(tx.transaction);
      message.data.block_id   = "";
      message.data.unixtime   = tx.transaction.ts;

      for (var y = 0; y < this.app.network.peers.length; y++) {
        if (this.app.network.peers[y].peer.publickey = this.archives[aas].publickey) {
	  this.app.network.peers[y].sendRequest(message.request, message.data);
        }
      }
    }
  }
}













