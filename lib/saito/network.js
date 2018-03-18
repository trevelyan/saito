var saito = require('../saito');


function Network(app) {

  if (!(this instanceof Network)) {
    return new Network(app);
  }

  this.app     = app || {};

  this.peers    		= [];
  this.peer_monitor_timer 	= null;
  this.peer_monitor_timer_speed = 10000;
  this.peers_connected 		= 0;
  this.peers_connected_limit	= 20;


  return this;
  
}
module.exports = Network;




Network.prototype.initialize = function initialize() {

  var network_self = this;

  // open connection to saved peers
  for (var i = 0; i < this.app.options.peers.length; i++) {
    this.addPeer(this.app.options.peers[i].host, this.app.options.peers[i].port);
  }

  // monitor peers
  this.peer_monitor_timer = setInterval(function() {
    for (var i = network_self.peers.length-1; i >= 0; i--) { 
      if (network_self.peers[i].isConnected() == 0) { 
	network_self.cleanupDisconnectedSocket(network_self.peers[i]);
      }
    }
  }, network_self.peer_monitor_timer_speed);

}


Network.prototype.addPeer = function addPeer(peerhost, peerport, sendblks=1, sendtx=1, sendgtix=1) {

  for (var bnm = 0; bnm < this.peers.length; bnm++) {
    if (this.peers[bnm].peer.host == peerhost && this.peers[bnm].peer.port == peerport) { 
      if (sendblks == 1) { this.peers[bnm].sendblocks = 1; }
      if (sendtx   == 1) { this.peers[bnm].sendtransactions = 1; }
      if (sendgtix == 1) { this.peers[bnm].sendtickets = 1; }
      return;
    }
  }

  if (this.app.options.server != null) {
    if (this.app.options.server.host == peerhost && this.app.options.server.port == peerport) { 
      console.log("Not adding "+this.app.options.server.host+" as peer as we run this server.");
      return; 
    }
  }

  this.peers.push(new saito.peer(this.app));
  this.peers[this.peers.length-1].peer.host        = peerhost;
  this.peers[this.peers.length-1].peer.port        = peerport;
  this.peers[this.peers.length-1].sendblocks       = sendblks;
  this.peers[this.peers.length-1].sendtransactions = sendtx;
  this.peers[this.peers.length-1].sendtickets      = sendgtix;
  this.peers[this.peers.length-1].connect();

  this.peers_connected++;


}
Network.prototype.addPeerWithSocket = function addPeerWithSocket(socket) {

  // this is where outside-originated connections
  // start, so we check our connection limit to 
  // ensure we aren't going crazy.
  if (this.peers_connected >= this.peers_connected_limit) {
    var message = {};
        message.request               = "connect-deny";
    socket.emit('request',JSON.stringify(message));
    socket.disconnect();
    return;
  }


  for (var i = 0; i < this.peers.length; i++) {
    if (this.peers[i].socket_id == socket.id) {
      console.log("error adding socket: already in pool");
      return;
    }
  }

  this.peers.push(new saito.peer(this.app));
  this.peers[this.peers.length-1].socket = socket;
  this.peers[this.peers.length-1].addSocketEvents();
  this.peers[this.peers.length-1].connect("remote-originated-connection");

  this.peers_connected++;

}
Network.prototype.cleanupDisconnectedSocket = function cleanupDisconnectedSocket(peer) {
  for (var c = 0; c < this.peers.length; c++) {
    if (this.peers[c] == peer) {
      this.peers.splice(c, 1);
      c--;
      this.peers_connected--;
    }
  }
}
Network.prototype.isConnected = function isConnected() {
  for (var networki = 0; networki < this.peers.length; networki++) {
    if (this.peers[networki].isConnected() == 1) { return 1; }
  }
  return 0;
}
Network.prototype.propagateBlock = function propagateBlock(blk) {
  this.sendBlock("block", blk);
}
Network.prototype.propagateGoldenTicket = function propagateGoldenTicket(gttx) {
  this.propagateTransaction(gttx, "golden ticket");
}
Network.prototype.propagateTransactionWithCallback = function propagateTransactionWithCallback(tx, mycallback=null) {
  this.propagateTransaction(tx, "transaction", mycallback);
}
Network.prototype.propagateTransaction = function propagateTransaction(tx, outboundMessage="transaction", mycallback=null) {

  if (tx == null) { return null; }

  for (var networki = 0; networki < this.peers.length; networki++) {

    // if peer not on path
    if (! this.peers[networki].inTransactionPath(tx) ) {

      // create a temporary transaction
      var tmptx = new saito.transaction();
          tmptx.transaction = JSON.parse(JSON.stringify(tx.transaction));

      // add our path
      var tmppath = new saito.path();
          tmppath.from = this.app.wallet.returnPublicKey();
          tmppath.to   = this.peers[networki].returnPublicKey();
          tmppath.sig  = this.app.crypt.signMessage(tmppath.to, this.app.wallet.returnPrivateKey());

      tmptx.transaction.path.push(tmppath);
      if (mycallback == null) {
	this.peers[networki].sendRequest(outboundMessage, JSON.stringify(tmptx.transaction));
      } else {
	this.peers[networki].sendRequestWithCallback(outboundMessage, JSON.stringify(tmptx.transaction), mycallback);
      }
    }
  }
}
Network.prototype.sendBlock = function sendBlock(message, blk) {
  for (var x = this.peers.length-1; x >= 0; x--) {
    this.peers[x].sendBlock(message, blk);
  }
}
Network.prototype.sendRequest = function sendRequest(message, data="") {
  for (var x = this.peers.length-1; x >= 0; x--) {
    this.peers[x].sendRequest(message, data);
  }
}
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


