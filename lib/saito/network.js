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

  // open a connection to each saved peer
  for (var i = 0; i < this.app.options.peers.length; i++) {
console.log("Adding Peer: ");
console.log(this.app.options.peers);
    this.addPeer(this.app.options.peers[i].host, this.app.options.peers[i].port);
  }

}








////////////////////
// Managing Peers //
////////////////////
Network.prototype.addPeer = function addPeer(peerhost, peerport, sendblks=1, sendtx=1, sendgtix=1) {

  // first we check to make sure we are not double-adding
  for (var bnm = 0; bnm < this.peers.length; bnm++) {
    if (this.peers[bnm].peer.host == peerhost && this.peers[bnm].peer.port == peerport) { 

      // it is possible we added this server as our DNS or ARCHIVE server and
      // it is also in our peer list. So we check to make sure the sendblks and sendtx
      // features are set if they are set here. We do NOT do that in reverse -- if
      // a request is set to add a server with no block/tx/gtix transmission we do 
      // not unset a server that is added elsewhere
      if (sendblks == 1) { this.peers[bnm].sendblocks = 1; }
      if (sendtx   == 1) { this.peers[bnm].sendtransactions = 1; }
      if (sendgtix == 1) { this.peers[bnm].sendtickets = 1; }

      return;
    }
  }

  this.peers.push(new saito.peer(this.app));
  this.peers[this.peers.length-1].peer.host        = peerhost;
  this.peers[this.peers.length-1].peer.port        = peerport;
  this.peers[this.peers.length-1].sendblocks       = sendblks;
  this.peers[this.peers.length-1].sendtransactions = sendtx;
  this.peers[this.peers.length-1].sendtickets      = sendgtix;

  // connect to server adds socket events automatically
console.log("Connecting to Peer: "+peerhost);
console.log(this.peers[this.peers.length-1].peer);
  this.peers[this.peers.length-1].connect();

}
Network.prototype.addPeerWithSocket = function addPeerWithSocket(socket) {

  // check we have not already added
  for (var i = 0; i < this.peers.length; i++) {
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



//////////////////////////
// Check Network Status //
//////////////////////////
Network.prototype.isConnected = function isConnected() {

  for (var networki = 0; networki < this.peers.length; networki++) {
    if (this.peers[networki].isConnected() == 1) { return 1; }
  }

  return 0;

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

  if (tx == null) { return null; }

  var hasher = saito.crypt();

  // open connection for each peer
  for (var networki = 0; networki < this.peers.length; networki++) {

    // check to see if this peer is on the path
    if (! this.peers[networki].inTransactionPath(tx) ) {

      // create a temporary transaction
      var tmptx = new saito.transaction();
          tmptx.transaction = JSON.parse(JSON.stringify(tx.transaction));

      // copy our path
      var tmppath = new saito.path();
          tmppath.from = this.app.wallet.returnPublicKey();
          tmppath.to   = this.peers[networki].returnPublicKey();
          tmppath.sig  = hasher.signMessage(tmppath.to, this.app.wallet.returnPrivateKey());

      tmptx.transaction.path.push(tmppath);

      this.peers[networki].sendRequest(outboundMessage, JSON.stringify(tmptx.transaction));

    }
  }
}
Network.prototype.sendRequest = function sendRequest(message, data="") {
  for (var x = 0; x < this.peers.length; x++) {
    this.peers[x].sendRequest(message, data);
  }
}




//
// fetches the blockchain from a remote peer
//
Network.prototype.fetchBlockchain = function fetchBlockchain() {
  for (var x = 0; x < this.peers.length; x++) {
    if (this.peers[x].socket != null) {
      if (this.peers[x].socket == true) {
        this.peers[x].fetchBlockchain();
        return;
      }
    }
  }
  return;
}






Network.prototype.returnPeers = function returnPeers() {
  return this.returnNetwork();
}
Network.prototype.returnFullNodePeersTotal = function returnFullNodePeersTotal() {
  var total_full_node_peers = 0;
  for (var c = 0; c < this.peers.length; c++) {
    if (this.peers[c].peer.synctype == "full") {
      total_full_node_peers++;
    }
  }
  return total_full_node_peers;
}
Network.prototype.returnPeersJson = function returnPeersJson() {
  return JSON.stringify(this.returnNetwork());
}
Network.prototype.returnNetworkJson = function returnNetworkJson() {
  return JSON.stringify(this.returnNetwork());
}
Network.prototype.returnNetwork = function returnNetwork() {
  var peerarray = [];
  for (var ib = 0; ib < this.peers.length; ib++) {
    peerarray.push(this.peers[ib].returnPeer());
  }
  return peerarray;
}






