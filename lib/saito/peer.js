var saito        = require('../saito');
var io           = require('socket.io-client');
var util         = require('util');
var EventEmitter = require('events').EventEmitter;




/////////////////
// CONSTRUCTOR //
/////////////////
function Peer(app, peerjson="") {

  if (!(this instanceof Peer)) {
    return new Peer(app, peerjson);
  }

  //EventEmitter.call(this);


  this.app = app || {};

  this.peer                = {};
  this.peer.host           = "localhost";
  this.peer.port           = "12100";
  this.peer.publickey      = "";

  this.socket              = null;
  this.socket_id           = null;


  if (peerjson != "") {
    this.peer = JSON.parse(peerjson);
  }

  return this;

}
//util.inherits(Peer, EventEmitter);
module.exports = Peer;














//
// ADD SOCKET EVENTS
//
// This is where the majority of the work is done programming
// the peer class to recognize and response to the core peer-
// to-peer messages in the system.
//
Peer.prototype.addSocketEvents = function addSocketEvents() {

  peer_self = this;

  this.socket.on('connect', function(){
    //console.log("client connect");
  });
  this.socket.on('event', function(){
    //console.log("peer event");
  });
  this.socket.on('disconnect', function(){
    //console.log("client disconnect");
  });




  //////////////////////////////
  // Handle Incoming Requests //
  //////////////////////////////
  this.socket.on('request', function (data) {

    var message  = JSON.parse(data.toString());
    var response = {}



    /////////////
    // connect //
    /////////////
    if (message.request == "connect") {

      peer_self.peer.publickey = message.data.publickey;
      thispeerlastblockid      = message.data.lastblock;

      if (thispeerlastblockid == "") {
        peer_self.sendBlocks(10);
      } else {
        if (peer_self.app.blockchain.longestChain > -1) {
          how_many_blocks_to_send = peer_self.app.blockchain.returnLatestBlock().returnId() - thispeerlastblockid;
          peer_self.sendBlocks(how_many_blocks_to_send);
        } else {
          peer_self.sendBlocks(10);
        }
      }

      response = peer_self.returnConnectResponse();
      peer_self.socket.emit('request',JSON.stringify(response));


      // try to send a payment just to see
      if (peer_self.peer.publickey != "") {
       if (peer_self.app.wallet.returnBalance() > 20) {
  	  nt = peer_self.app.wallet.createUnsignedTransactionWithFee(peer_self.peer.publickey, 20, 0.005);
	  nt = peer_self.app.wallet.signTransaction(nt);
          peer_self.app.blockchain.mempool.addTransaction(nt);
          peer_self.app.network.propagateTransaction(nt);
console.log("CREATED TRANSACTION FOR PEER");
console.log(nt);
	}
      }

      return;

    }
    if (message.request == "connect-reply") {

      // save public key
      peer_self.peer.publickey = message.data.publickey;

      // provide public key (if asked)
      if (peer_self.peer.publickey == "") {
        response = peer_self.returnConnectResponse();
        peer_self.socket.emit('request',JSON.stringify(response));
      }

      // let browser know (if running) how many
      // blocks we have yet to sync
      peer_self.app.browser.monitorBlockchainSyncing(message.data.current_block_id, message.data.current_genesis_block_id);

      // save options
      peer_self.app.storage.saveOptions();
      return;
    }





    ///////////////////////////////////////////////
    // Sending and Receiving Standard Data Types //
    ///////////////////////////////////////////////

    // missing blocks
    if (message.request == "missing block") {
      sql = "SELECT * FROM blocks WHERE hash = $hash";
      params = {hash:message.data.hash};
      peer_self.app.storage.queryBlockchain(sql, params, function (err, row) {
        if (row != null) {
          if (row.block != null) {
            response = {};
            response.request = "block";
            response.data = row.block;
            peer_self.socket.emit('request',JSON.stringify(response));
          }
        }
      });
      return;
    }


    // blocks
    if (message.request == "block") {
      // blockchain confirms and adds network propagation
      peer_self.app.blockchain.importBlock(message.data);
      return;
    }


    // transactions
    if (message.request == "transaction") {
      var tx = new saito.transaction(message.data);
      peer_self.app.network.propagateTransaction(tx);
      peer_self.app.blockchain.mempool.importTransaction(message.data);
      return;
    }


    // golden ticket
    if (message.request == "golden ticket") {

console.log("RECEIVED GOLDEN TICKET!");

      var tx = new saito.transaction(message.data);
      peer_self.app.network.propagateGoldenTicket(tx);
      peer_self.app.blockchain.mempool.importTransaction(message.data);
      return;
    }




  });


}







//////////////////////////
// Connection Managment //
//////////////////////////
Peer.prototype.connect = function connect(remote=0) {

  // the remote variable depends on whether
  // we are making the connection to another
  // peer (remote == 0) or whether we are
  // confirming a connection that has been 
  // made to us.
  //
  // this is triggered if we are initializing 
  // a connection to a remote server
  if (remote == 0) {

    var serverAddress = "http://"+this.peer.host+":"+this.peer.port;
    var socket = io(serverAddress);
    this.socket = socket;

    // affix this socket to our events
    this.addSocketEvents();

    // test we are working
    var message = {};
        message.encrypted         = "no";
        message.request           = "connect";
        message.data              = {};
        message.data.lastblock    = "";
        message.data.publickey    = this.app.wallet.returnPublicKey();

    if (this.app.options.lastblock != "") {
      message.data.lastblock    = this.app.options.lastblock;
    }
    if (this.app.blockchain.index.longestChain > 0) {
      message.data.lastblock = this.app.blockchain.returnLatestBlock().block.header.id;
    }

    socket.emit('request',JSON.stringify(message));

  } else {

    // here we respond to a connection attempt
    // by confirming we have all of the information
    // we need about the remote host
    response = this.returnConnectResponse();
    this.socket.emit('request',JSON.stringify(response));

  }
}
Peer.prototype.returnConnectResponse = function createConnectResponse() {

  response                               = {};
  response.request                       = "connect-reply";
  response.data                          = {};
  response.data.publickey                = this.app.wallet.returnPublicKey();
  response.data.current_block_id         = this.app.blockchain.returnLatestBlockId();
  response.data.current_genesis_block_id = this.app.blockchain.returnGenesisBlockId();

  if (this.peer.publickey == "") {
    response.data.sendConnectReplyResponse = 1;
  } else {
    response.data.sendConnectReplyResponse = 0;
  }

  return response;

}

























///////////////////
// Sending Stuff //
///////////////////
Peer.prototype.sendBlocks = function sendBlocks(blocks_to_send) {

  if (blocks_to_send < 0) { blocks_to_send = 0; }
  if (blocks_to_send == 0) { return; }

console.log("\n\nBLOCKS TO SEND: "+blocks_to_send);

  lc = this.app.blockchain.returnLongestChain(blocks_to_send);

console.log("Len: "+lc.length);

  for (bb = 0; bb < lc.length; bb++) {
      response = {};
      response.request = "block";
      response.data = JSON.stringify(lc[bb].block);
console.log("SENDING BLOCK: "+lc[bb].returnId());
      this.socket.emit('request',JSON.stringify(response));
  }

}
Peer.prototype.sendRequest = function sendRequest(message, data="") {

  // find out initial state of peer and blockchain
  var userMessage = {};
      userMessage.request  = message;
      userMessage.data     = data;

  // only send if we have an active connection
  if (this.socket != null) {
    this.socket.emit('request',JSON.stringify(userMessage));
  }

}











/////////////////////
// Path Management //
/////////////////////
Peer.prototype.inTransactionPath = function inTransactionPath(tx) {
  if (tx.isFrom(this.peer.publickey)) {
    return 1;
  }
  for (z = 0; z < tx.transaction.path.length; z++) {
    if (tx.transaction.path[z].from == this.peer.publickey) {
      return 1;
    }
  }
  return 0;
}









Peer.prototype.returnPeer = function returnPeer() {
  return this.peer;
}
Peer.prototype.returnPeerJson = function returnPeerJson() {
  return JSON.stringify(this.peer);
}
Peer.prototype.returnPublicKey = function returnPublicKey() {
  return this.peer.publickey;
}







