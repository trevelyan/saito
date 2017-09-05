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

  this.dns.domains       = [];  // { domain : "", publickey : "" }


  if (dnsjson != "") {
    this.dns = JSON.parse(dnsjson);
  }

  return this;

}
module.exports = DNS;



////////////////
// Initialize //
////////////////
DNS.prototype.initialize = function initialize() {

console.log("INITILIZING DNS");

  if (this.app.options.dns != null) {
    for (i = 0; i < this.app.options.dns.length; i++) {
      this.dns.domains[i] = this.app.options.dns[i];
    }
  }

console.log(this.dns);
}



DNS.prototype.isConnectedToAppropriateServer = function isConnectedToAppropriateServer(domainid) {
  for (s = 0; s < this.dns.domains.length; s++) {
    if (this.dns.domains[s].domain == domainid) { 
      for (t = 0; t < this.app.network.peers.length; t++) {
	if (this.dns.domains[s].publickey == this.app.network.peers[t].peer.publickey && this.app.network.peers[t].peer.publickey != "") {
          return 1;
        }
      }
    }
  }
  return 1;
}
DNS.prototype.fetchIdFromAppropriateServer = function fetchIdFromAppropriateServer(publickey, mycallback) {

  for (s = 0; s < this.dns.domains.length; s++) {
    for (t = 0; t < this.app.network.peers.length; t++) {
      if (this.dns.domains[s].publickey == this.app.network.peers[t].peer.publickey) {

        // find out initial state of peer and blockchain
        var userMessage = {};
            userMessage.request         = "dns";
            userMessage.data            = {};
            userMessage.data.publickey  = publickey;

        // fetch publickey of peer
        this.app.network.peers[t].sendRequestWithCallback(userMessage.request, userMessage.data, mycallback);
        return;

      }
    }
  }

  return;

}
DNS.prototype.fetchRecordFromAppropriateServer = function fetchRecordFromAppropriateServer(id, mycallback) {

  domain = "";
  domain_server_exists = 0;
  alternate_server_exists = 0;

  if (id.indexOf("@") > 0) { domain = id.substring(id.indexOf("@")+1); }

  if (this.dns.domains.length == 0) {
    tmpr = {}; tmpr.err = "no dns servers";
    mycallback(JSON.stringify(tmpr));
    return;
  }

  for (s = 0; s < this.dns.domains.length; s++) {

    if (this.dns.domains[s].domain == domain) { 
      alternate_server_exists = 1;
      for (t = 0; t < this.app.network.peers.length; t++) {
	if (this.dns.domains[s].publickey == this.app.network.peers[t].peer.publickey && this.app.network.peers[t].peer.publickey != "") {

	  domain_server_exists = 1;

          // find out initial state of peer and blockchain
          var userMessage = {};
              userMessage.request         = "dns";
              userMessage.data            = {};
              userMessage.data.identifier = id;

	  // fetch publickey of peer
          this.app.network.peers[t].sendRequestWithCallback(userMessage.request, userMessage.data, mycallback);
          return;
        }
      }
    }
  }

  tmpr = {};
  if (domain_server_exists == 0) {
    if (alternate_server_exists == 1) {
      tmpr.err = "dns server publickey changed";
      mycallback(JSON.stringify(tmpr));
      return;
    } else {
      tmpr.err = "server not found";
      mycallback(JSON.stringify(tmpr));
      return;
    }
  }

  return;
}




DNS.prototype.addDomain = function addDomain(server_domain, server_publickey) {
  tmpx = {};
  tmpx.domain = server_domain;
  tmpx.publickey = server_publickey;
  for (bvc = 0; bvc < this.dns.domains.length; bvc++) {
    if (JSON.stringify(this.dns.domains[bvc]) == JSON.stringify(tmpx)) { return; }
  }
  this.dns.domains.push(tmpx);
}
DNS.prototype.returnDNS = function returnDNS() {
  return this.dns;
}
DNS.prototype.returnDNSJson = function returnDNSJson() {
  return JSON.stringify(this.returnDNS());
}







