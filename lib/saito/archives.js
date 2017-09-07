var saito = require('../saito');


function Archives(app, archivesjson="") {

  if (!(this instanceof Archives)) {
    return new Archives(app, archivesjson);
  }

  this.app                 = app || {};
  this.archives            = []; // {"host":"saito.tech","port":12100,"publickey":"", "active":"inactive", "type":"messages"}
  this.messages            = [];
  this.local_storage_limit = 4;

  if (archivesjson != "") {
    this.archives = JSON.parse(archivesjson);
  }

  return this;

}
module.exports = Archives;

//
// RESET should delete from any archived servers as well
//
//






Archives.prototype.resetArchives = function resetArchives() {
  console.log("\n\n\nRESETTING ARCHIVES...\n\n\n");
  this.messages = [];
  if (this.app.BROWSER == 1) {
    if (typeof(Storage) !== "undefined") {
      localStorage.setItem("messages", JSON.stringify(this.messages));
    }
  }

  // reset remote active archives
  message                 = {};
  message.request         = "archive reset request";
  message.data            = {};
  message.data.publickey  = this.app.wallet.returnPublicKey();
  message.data.unixtime   = new Date().getTime();

  for (aas = 0; aas < this.archives.length; aas++) {
    if (this.archives[aas].active == "active") {
      for (y = 0; y < this.app.network.peers.length; y++) {
        if (this.app.network.peers[y].peer.publickey = this.archives[aas].publickey) {
          this.app.network.peers[y].sendRequest(message.request, message.data);
        }
      }
    }
  }


}







////////////////
// Initialize //
////////////////
Archives.prototype.initialize = function initialize() {

  if (this.app.options.archives != null) {
    for (i = 0; i < this.app.options.archives.length; i++) {
      this.archives[i] = this.app.options.archives[i];
    }
  }


  // add any archives to our peer list and connect as needed
  for (vcm = 0; vcm < this.archives.length; vcm++) {
    this.app.network.addPeer(this.archives[vcm].host, this.archives[vcm].port);
  }


  // load content
  this.loadMessages();

}






Archives.prototype.containsMessageById = function containsMessageById(tx_id) {
  for (amt = this.messages.length-1; amt >= 0; amt--) {
    if (this.messages[amt].transaction.id == tx_id) { return 1; }
  }
  return 0;
}

Archives.prototype.saveMessage = function saveMessage(tx) {

console.log("SAVING MESSAGE in ARCHIVE CLASS:");
console.log(tx);

  ///////////////////
  // store locally //
  ///////////////////
  if (this.app.BROWSER == 1) {
    if (typeof(Storage) !== "undefined") {

      // reload before saving
      data = localStorage.getItem("messages");
      this.messages = JSON.parse(data);
      if (this.messages == null) {
	console.log("resetting Message array in Archives saveMessage");
	this.messages = [];
      }

      // if we are at our local storage limit remove the
      // last email and add our new one to the top
      if (this.messages.length == this.local_storage_limit) {
        for (mb = 0; mb < this.messages.length-1; mb++) {
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
  for (aas = 0; aas < this.archives.length; aas++) {
    if (this.archives[aas].active == "active") {
      
      message                 = {};
      message.request         = "archive";
      message.data            = {};
      message.data.publickey  = this.app.wallet.returnPublicKey();
      message.data.tx         = JSON.stringify(tx.transaction);
      message.data.block_id   = "";
      message.data.unixtime   = tx.transaction.ts;

      for (y = 0; y < this.app.network.peers.length; y++) {
        if (this.app.network.peers[y].peer.publickey = this.archives[aas].publickey) {
	  this.app.network.peers[y].sendRequest(message.request, message.data);
        }
      }
    }
  }

}



Archives.prototype.loadMessages = function loadMessages(number = 50, offset = 0) {

  // Local Storage (default)
  if (this.app.BROWSER == 1) {
    if (typeof(Storage) !== "undefined") {
      data = localStorage.getItem("messages");
      this.messages = JSON.parse(data);
      if (this.messages == null) { 
	this.messages = []; 
      } 
    }
  }


  for (s = 0; s < this.archives.length; s++) {
    for (t = 0; t < this.app.network.peers.length; t++) {
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
  tmpmsg = [];
  starting_point = this.messages.length - number;  if (starting_point < 0) { starting_point = 0; }
  for (n = starting_point; n < this.messages.length; n++) {
    tmpmsg[n] = this.messages[n];
  }
  err    = {};
  callback(err, tmpmsg);
}



Archives.prototype.removeMessage = function removeMessage(txid) {

  mytxid = txid;
  mytxts = 0;

  for (n = this.messages.length-1; n >= 0; n--) {
    if (this.messages[n].transaction.id == txid) {
      mytxts = this.messages[n].transaction.ts;
      this.messages.splice(n,1);
      n = this.messages.length;
      this.saveArchives();
    }
  }


  
  /////////////////////////////////
  // delete from backup services // (if connected)
  /////////////////////////////////
  for (aas = 0; aas < this.archives.length; aas++) {
    if (this.archives[aas].active == "active") {
      
      message                 = {};
      message.request         = "archive delete request";
      message.data            = {};
      message.data.publickey  = this.app.wallet.returnPublicKey();
      message.data.txid       = mytxid;
      message.data.txts       = mytxts;
      message.data.unixtime   = tx.transaction.ts;

      for (y = 0; y < this.app.network.peers.length; y++) {
        if (this.app.network.peers[y].peer.publickey = this.archives[aas].publickey) {
	  this.app.network.peers[y].sendRequest(message.request, message.data);
        }
      }
    }
  }




}




Archives.prototype.addArchive = function addArchive(server_domain, server_port, server_publickey, active="inactive", archivetype="transactions") {
  tmpx = {};
  tmpx.domain    = server_domain;
  tmpx.port      = server_port;
  tmpx.publickey = server_publickey;
  tmpx.active    = active;
  tmpx.type      = archivetype;
  for (bvc = 0; bvc < this.archives.length; bvc++) {
    if (JSON.stringify(this.archives[bvc]) == JSON.stringify(tmpx)) { return; }
  }
  this.archives.push(tmpx);
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
Archives.prototype.returnArchives = function returnArchives() {
  return this.archives;
}
Archives.prototype.returnArchivesJson = function returnArchivesJson() {
  return JSON.stringify(this.returnArchives());
}
Archives.prototype.returnTransactionById = function returnTransactionById(txid) {
  for (mv = this.messages.length-1; mv >= 0; mv--) {
    if (this.messages[mv].transaction.id == txid) { return this.messages[mv]; }
  }
  return null;
}










