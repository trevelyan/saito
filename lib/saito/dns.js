var saito = require('../saito');

//
// The DNS module is how applications connect to the DNS layer
//
// Basically, applications call the functions in this class, which
// connect to the servers provided as part of the configuration file
// to fetch the data on which addresses translate to which domains.
//
// Servers can setup domains by running Registry modules and 
// configuring them for whatever domain they want to support.
//
function DNS(app, dnsjson="") {

  if (!(this instanceof DNS)) {
    return new DNS(app, dnsjson);
  }

  this.app     = app || {};


  ////////////////////////////
  // serialized for storage //
  ////////////////////////////
  this.dns               = {};
  this.dns.domains       = [];


  if (dnsjson != "") {
    this.dns = JSON.parse(dnsjson);
  }

  return this;

}
module.exports = DNS;



DNS.prototype.addDomain = function addDomain(server_domain, server_publickey) {
  var tmpx = {};
  tmpx.domain = server_domain;
  tmpx.publickey = server_publickey;
  for (var bvc = 0; bvc < this.dns.domains.length; bvc++) {
    if (JSON.stringify(this.dns.domains[bvc]) == JSON.stringify(tmpx)) { return; }
  }
  this.dns.domains.push(tmpx);
}
DNS.prototype.fetchIdFromAppropriateServer = function fetchIdFromAppropriateServer(publickey, mycallback) {

  for (var s = 0; s < this.dns.domains.length; s++) {
    for (var t = 0; t < this.app.network.peers.length; t++) {
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

  var domain = "";
  var domain_server_exists = 0;
  var alternate_server_exists = 0;

  if (id.indexOf("@") > 0) { domain = id.substring(id.indexOf("@")+1); }

  if (this.dns.domains.length == 0) {
    var tmpr = {}; tmpr.err = "no dns servers";
    mycallback(JSON.stringify(tmpr));
    return;
  }

  for (var s = 0; s < this.dns.domains.length; s++) {
    if (this.dns.domains[s].domain == domain) { 
      alternate_server_exists = 1;
      for (var t = 0; t < this.app.network.peers.length; t++) {
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

  var tmpr = {};
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
DNS.prototype.initialize = function initialize() {

  if (this.app.options.dns != null) {
    for (var i = 0; i < this.app.options.dns.length; i++) {
      this.dns.domains[i] = this.app.options.dns[i];
    }
  }

  // try to connect to our DNS servers as peers
  for (var i = 0; i < this.dns.domains.length; i++) {
    // do not send blocks, transactions, or tickets by default to DNS servers
    this.app.network.addPeer(this.dns.domains[i].host, this.dns.domains[i].port, 0, 0, 0);
  }

}
DNS.prototype.isConnectedToAppropriateServer = function isConnectedToAppropriateServer(domainid) {
  for (var s = 0; s < this.dns.domains.length; s++) {
    if (this.dns.domains[s].domain == domainid) { 
      for (var t = 0; t < this.app.network.peers.length; t++) {
	if (this.dns.domains[s].publickey == this.app.network.peers[t].peer.publickey && this.app.network.peers[t].peer.publickey != "") {
          return 1;
        }
      }
    }
  }
  return 1;
}
DNS.prototype.isRecordValid = function isRecordValid(answer) {

  var obj = JSON.parse(answer);

  if (obj.err != "") { return 0; }

  var msgtoverify = obj.identifier + obj.publickey + obj.unixtime;
  var registrysig = this.app.crypt.verifyMessage(msgtoverify, obj.signature, obj.signer);

  console.log("VERIFYING: ");
  console.log(JSON.stringify(obj));
  console.log(msgtoverify);
  console.log(registrysig);

  return 1;

}
DNS.prototype.returnDNS = function returnDNS() {
  return this.dns.domains;
}
DNS.prototype.returnDNSJson = function returnDNSJson() {
  return JSON.stringify(this.returnDNS());
}







