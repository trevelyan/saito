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
// This is where the majority of the work is done programming
// the peer class to recognize and response to the core peer-
// to-peer messages in the system.
//
Peer.prototype.addSocketEvents = function addSocketEvents() {

  peer_self = this;

  this.socket.on('connect', function(){
    console.log("client connect");
  });
  this.socket.on('event', function(){
    console.log("peer event");
  });
  this.socket.on('disconnect', function(){
    console.log("client disconnect");
  });




  //////////////////////////////
  // Handle Incoming Requests //
  //////////////////////////////
  this.socket.on('request', function (data) {

    var message  = JSON.parse(data.toString());
    var response = {}


    console.log("INCOMING REQUEST: ");
    console.log(message);


    // connect
    if (message.request == "connect") {
      console.log("Connecting to Peer");
    }

    if (message.request == "connect-reply") {

      // grab public key of peer
      peer_self.peer.publickey = message.data.publickey;

      // if remote party wants my node info, we provide
      if (peer_self.peer.publickey == "") {
        response = peer_self.createConnectReplyResponse();
        peer_self.socket.emit('request',JSON.stringify(response));
      }

      // save options, including peer key, etc.
      peer_self.app.storage.saveOptions();

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
    response = this.createConnectReply();
    this.socket.emit('request',JSON.stringify(response));

  }
}
Peer.prototype.createConnectReply = function createConnectReply() {

  response                   = {};
  response.request           = "connect-reply";
  response.data              = {};
  response.data.publickey    = this.app.wallet.returnPublicKey();

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

  if (blocks_to_send < 0) { blocks_to_send *= -1; }

  var lc = this.app.blockchain.returnLongestChain(blocks_to_send);

  for (bb = lc.length-1; bb >= 0; bb--) {
      response = {};
      response.request = "block";
      response.data = JSON.stringify(lc[bb].block);
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








Peer.prototype.returnPublicKey = function returnPublicKey() {
  return this.peer.publickey;
}











Peer.prototype.inTransactionPath = function inTransactionpath(tx) {
  if (tx.transaction.payment.from == this.peer.publickey) {
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







