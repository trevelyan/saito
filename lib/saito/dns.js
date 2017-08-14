var saito = require('../saito');


function DNS(app, dnsjson="") {

  if (!(this instanceof DNS)) {
    return new DNS(app, dnsjson);
  }

  this.app     = app || {};


  ////////////////////////////
  // serialized for storage //
  ////////////////////////////
  this.dns               = {};

  // local records
  this.dns.keys          = [];  // { identifier : "", publickey : "" }


  // trusted places
  this.dns.domains       = [];  // { identifier : "", publickey : "" }




  if (dnsjson != "") {
    this.peer = JSON.parse(dnsjson);
  }

  return this;

}
module.exports = DNS;



////////////////
// Initialize //
////////////////
DNS.prototype.initialize = function initialize() {

  if (this.app.options.dns != null) {
    for (i = 0; i < this.app.options.dns.length; i++) {
      this.dns.domains[i] = this.app.options.dns[i];
    }
  }

}



DNS.prototype.isConnectedToAppropriateServer = function isConnectedToAppropriateServer(id) {
  for (s = 0; s < this.dns.domains.length; s++) {
    if (this.dns.domains[s].identifier == id) { 
      for (t = 0; t < this.app.network.peers.length; t++) {
	if (this.dns.domains[s].publickey == this.app.network.peers[t].peer.publickey && this.app.network.peers[t].peer.publickey != "") {
          return 1;
        }
      }
    }
  }
  return 1;
}
DNS.prototype.fetchRecordFromAppropriateServer = function fetchRecordFromAppropriateServer(id, mycallback) {

  domain = "";

console.log(this.dns.domains);
console.log("0");
  if (id.indexOf("@") > 0) { domain = id.substring(id.indexOf("@")+1); }
console.log(domain);
console.log("1");
  for (s = 0; s < this.dns.domains.length; s++) {
console.log("2");
console.log(this.dns.domains[s].domain);

    if (this.dns.domains[s].domain == domain) { 
console.log("3");
      for (t = 0; t < this.app.network.peers.length; t++) {
console.log("4");
	if (this.dns.domains[s].publickey == this.app.network.peers[t].peer.publickey && this.app.network.peers[t].peer.publickey != "") {
console.log("5");

console.log("SENDING THE DNS request into the Internet!");

          // find out initial state of peer and blockchain
          var userMessage = {};
              userMessage.request         = "dns";
              userMessage.data            = {};
              userMessage.data.identifier = id;

	  // fetch publickey of peer
          this.app.network.peers[t].sendRequestWithCallback(userMessage.request, userMessage.data, mycallback);

        }
      }
    }
  }
  return;
}






DNS.prototype.returnIdentifier = function returnIdentifier(publickey) {
  for (s = 0; s < this.dns.keys.length; s++) {
    if (this.dns.keys[s].publickey == publickey) { return this.dns.keys[s].identifier; }
  }
  return "";
}
DNS.prototype.returnPublicKey = function returnPublicKey(id) {
  for (s = 0; s < this.dns.keys.length; s++) {
    if (this.dns.keys[s].identifir == id) { return this.dns.keys[s].publickey; }
  }
  return "";
}
DNS.prototype.addKey = function addKey(id, publickey) {
  tmpx = {};
  tmpx.identifier = id;
  tmpx.publickey = publickey;
  this.dns.keys.push(tmpx); 
}
DNS.prototype.addDomain = function addDomain(server_domain, server_publickey) {
  tmpx = {};
  tmpx.domain = server_domain;
  tmpx.publickey = server_publickey;
  this.dns.domains.push(tmpx);
}
DNS.prototype.returnDNS = function returnDNS() {
  return this.dns;
}
DNS.prototype.returnDNSJson = function returnDNSJson() {
  return JSON.stringify(this.returnDNS());
}





