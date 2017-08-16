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
    this.dns = JSON.parse(dnsjson);
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
  domain_server_exists = 0;
  alternate_server_exists = 0;

  if (id.indexOf("@") > 0) { domain = id.substring(id.indexOf("@")+1); }

console.log("DOMAIN: "+domain);
console.log(this.dns.domains);

  for (s = 0; s < this.dns.domains.length; s++) {

console.log("   and "+this.dns.domains[s].domain);

    if (this.dns.domains[s].domain == domain) { 

      alternate_server_exists = 1;

      for (t = 0; t < this.app.network.peers.length; t++) {
console.log(this.dns.domains[s].publickey + " -- " + this.app.network.peers[t].peer.publickey);
	if (this.dns.domains[s].publickey == this.app.network.peers[t].peer.publickey && this.app.network.peers[t].peer.publickey != "") {

	  domain_server_exists = 1;

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

  if (domain_server_exists == 0) {
    if (alternate_server_exists == 1) {
      mycallback("Your DNS records are out-of-date. Public key has changed");
    } else {
      mycallback("server not found");
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
console.log("ADDING DNS server: ");
console.log(tmpx);
  for (bvc = 0; bvc < this.dns.domains.length; bvc++) {
    if (JSON.stringify(this.dns.domains[bvc]) == JSON.stringify(tmpx)) { return; }
  }
console.log("... and added")
  this.dns.domains.push(tmpx);
}
DNS.prototype.returnDNS = function returnDNS() {
  return this.dns;
}
DNS.prototype.returnDNSJson = function returnDNSJson() {
  return JSON.stringify(this.returnDNS());
}





