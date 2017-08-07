var saito = require('../saito');




/////////////////
// CONSTRUCTOR //
/////////////////
function Network(app) {

  if (!(this instanceof Network)) {
    return new Network(app);
  }

  this.app     = app || {};

  this.peers    = [];

  return this;

}
module.exports = Network;




Network.prototype.initialize = function initialize() {

console.log("NETWORK: ");
console.log(this.app.options.network);

  // open a connection to each saved peer
  for (i = 0; i < this.app.options.network.length; i++) {
    this.addPeer(this.app.options.network[i].host, this.app.options.network[i].port);
  }

}








////////////////////
// Managing Peers //
////////////////////
Network.prototype.addPeer = function addPeer(peerhost, peerport) {

  this.peers.push(new saito.peer(this.app));
  this.peers[this.peers.length-1].peer.host = peerhost;
  this.peers[this.peers.length-1].peer.port = peerport;

  // connect to server adds socket events automatically
  this.peers[this.peers.length-1].connect();

}
Network.prototype.addPeerWithSocket = function addPeerWithSocket(socket) {

  // check we have not already added
  for (i = 0; i < this.peers.length; i++) {
    if (this.peers[i].socket_id == socket.id) {
      console.log("error adding socket: already in pool");
      return;
    }
  }

  // add a new peer
  this.peers.push(new saito.peer(this.app));
  this.peers[this.peers.length-1].socket = socket;
  this.peers[this.peers.length-1].addSocketEvents();

  // send peer our information
  this.peers[this.peers.length-1].connect("remote-originated-connection");

}







//////////////////
// Sending Data //
//////////////////
Network.prototype.propagateBlock = function propagateBlock(blk) {
  this.sendRequest("block", JSON.stringify(blk.block));
}
Network.prototype.propagateGoldenTicket = function propagateGoldenTicket(gttx) {
  this.propagateTransaction(gttx, "golden ticket");
}
Network.prototype.propagateTransaction = function propagateTransaction(tx, outboundMessage="transaction") {

  var hasher = saito.crypt();

  // open connection for each peer
  for (i = 0; i < this.peers.length; i++) {

    // check to see if this peer is on the path
    if (! this.peers[i].inTransactionPath(tx) ) {

      // create a temporary transaction
      var tmptx = new saito.transaction();
          tmptx.transaction = JSON.parse(JSON.stringify(tx.transaction));

console.log("This is what we are sending:");
console.log(tmptx.transaction);

      // copy our path
      var tmppath = new saito.path();
          tmppath.from = this.app.wallet.returnPublicKey();
          tmppath.to   = this.peers[i].returnPublicKey();
          tmppath.sig  = hasher.signMessage(tmppath.to, this.app.wallet.returnPrivateKey());

      tmptx.transaction.path.push(tmppath);

      this.peers[i].sendRequest(outboundMessage, JSON.stringify(tmptx.transaction));

    }
  }
}
Network.prototype.sendRequest = function sendRequest(message, data="") {
  for (x = 0; x < this.peers.length; x++) {
    this.peers[x].sendRequest(message, data);
  }
}







Network.prototype.returnNetworkJson = function returnNetworkJson() {
  return JSON.stringify(this.returnNetwork());
}
Network.prototype.returnNetwork = function returnNetwork() {
  peerarray = [];
  for (i = 0; i < this.peers.length; i++) {
    peerarray.push(this.peers.returnPeer());
  }
  return peerarray;
}






