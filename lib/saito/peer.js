var saito        = require('../saito');
var io           = require('socket.io-client');
var util         = require('util');



/////////////////
// CONSTRUCTOR //
/////////////////
function Peer(app, peerjson="") {

  if (!(this instanceof Peer)) {
    return new Peer(app, peerjson);
  }


  this.app = app || {};

  this.peer                  = {};
  this.peer.host             = "localhost";
  this.peer.port             = "12100";
  this.peer.publickey        = "";
  this.peer.synctype         = "full"; 		// full = full blocks
						// lite = spv client


  this.peer.watchedkeylist   = [];		// only used with lite/spv modes

  this.sendblocks            = 1;
  this.sendtransactions      = 1;
  this.sendtickets           = 1;

  this.message_queue         = [];
  this.message_queue_speed   = 1000;
  this.message_queue_timer   = null;
  this.socket                = null;
  this.socket_id             = null;

  


  if (peerjson != "") {
    this.peer = JSON.parse(peerjson);
  }

  return this;

}
module.exports = Peer;








Peer.prototype.initialize = function initialize() {

  peer_self = this;

  this.message_queue_timer = setInterval(function() {
    peer_self.sendQueuedRequest();
  }, this.message_queue_speed);

}





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
  this.socket.on('request', function (data, mycallback) {

    var message  = JSON.parse(data.toString());
    var response = {}



console.log("RECEIVED MESSAG: ");
console.log(message);

    /////////////////////
    // send to modules //
    /////////////////////
    peer_self.app.modules.handlePeerRequest(message, peer_self);


    /////////////
    // connect //
    /////////////
    if (message.request == "connect") {

      peer_self.peer.publickey = message.data.publickey;
      thispeerlastblockid      = message.data.lastblock;
      synctype                 = message.data.synctype;
      pklist                   = message.data.keystowatch;

      peer_self.peer.synctype       = synctype;
      peer_self.peer.watchedkeylist = pklist;

      mylastblock              = peer_self.app.blockchain.returnLatestBlock();
      mylastblockid            = 0;
      if (mylastblock != null) { mylastblockid = mylastblock.returnId(); }

      // if we are lite-sync mode, we only feed out
      // the last 10 blocks. if we are full-sync mode
      // we init from the first block unless otherwise
      // instructed with a start point
      if (peer_self.peer.synctype == "lite") {
        if (thispeerlastblockid === "") {
          startblockid = mylastblockid-10;
          if (startblockid < 0) { startblockid = 0; }
          peer_self.sendBlockchain(startblockid, synctype, pklist);
        } else {
          peer_self.sendBlockchain(thispeerlastblockid, synctype, pklist);
        }
      } else {
        if (thispeerlastblockid === "") {
          peer_self.sendBlockchain(0, synctype, pklist);
        } else {
          peer_self.sendBlockchain(thispeerlastblockid, synctype, pklist);
        }
      }


      response = peer_self.returnConnectResponse();
      peer_self.socket.emit('request',JSON.stringify(response));


      // try to send a payment just to see
      if (peer_self.peer.publickey != "") {
       if (peer_self.app.wallet.returnBalance() > 20) {
  	  nt = peer_self.app.wallet.createUnsignedTransactionWithFee(peer_self.peer.publickey, 20, 1.9);
	  nt = peer_self.app.wallet.signTransaction(nt);
          peer_self.app.blockchain.mempool.addTransaction(nt);
          peer_self.app.network.propagateTransaction(nt);
	}
      }
      return;
    }
    if (message.request == "connect-reply") {

      // save public key
      peer_self.peer.publickey = message.data.publickey;
      for (vc = 0; vc < message.data.dns.length; vc++) {
        peer_self.app.dns.addDomain(message.data.dns[vc], peer_self.peer.publickey);
      }

      // provide public key (if asked)
      if (peer_self.peer.publickey == "") {
        response = peer_self.returnConnectResponse();
        peer_self.socket.emit('request',JSON.stringify(response));
      }

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
      tmpr = JSON.parse(message.data);
      params = { $hash : tmpr.hash};
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

console.log("RECEIVED BLOCK...");

      // blockchain confirms and adds network propagation
      if (peer_self.peer.synctype == "full") {
        peer_self.app.blockchain.importBlock(message.data);
      } else {
        // lite blocks not relayed
        peer_self.app.blockchain.importBlock(message.data, 0);
      }
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
      var tx = new saito.transaction(message.data);
      peer_self.app.network.propagateGoldenTicket(tx);
      peer_self.app.blockchain.mempool.importTransaction(message.data);
      return;
    }



    // blockchain
    if (message.request == "blockchain") {
      peer_self.sendBlockchain(message.data.block_id, message.data.synctype);
      return;
    }





    // dns requests -- all handled by modules
    if (message.request == "dns") {
      peer_self.app.modules.handleDomainRequest(message, peer_self, mycallback);
    }



  });





}







//////////////////////////
// Connection Managment //
//////////////////////////
Peer.prototype.connect = function connect(remote=0) {

console.log("CONNECTING: " + remote);

  // the remote variable depends on whether
  // we are making the connection to another
  // peer (remote == 0) or whether we are
  // confirming a connection that has been 
  // made to us.
  //
  // this is triggered if we are initializing 
  // a connection to a remote server
  if (remote == 0) {

    // refuse to cause problems out of principle
    if (this.peer.host == "localhost" && this.app.BROWSER == 0) { return; }
    if (this.peer.host == "localhost" && this.app.BROWSER == 1) { }


    var serverAddress = "http://"+this.peer.host+":"+this.peer.port;
    var socket = io(serverAddress);
    this.socket = socket;

console.log("CONNECTING TO: "+serverAddress);

    // affix this socket to our events
    this.addSocketEvents();
    // test we are working
    var message = {};
        message.encrypted         = "no";
        message.request           = "connect";
        message.data              = {};
        message.data.lastblock    = "";
        message.data.keystowatch  = [];
        tempkeyarray = this.app.keys.returnPublicKeysWatchedArray();
        tempkeyarray.push(this.app.wallet.returnPublicKey());
        message.data.keystowatch  = tempkeyarray;
        message.data.synctype         = "full";
        if (this.app.SPVMODE == 1) {
	  this.peer.synctype            = "lite";
          message.data.synctype         = "lite";
        }
        message.data.publickey    = this.app.wallet.returnPublicKey();
    if (this.app.options.blockchain.latest_block_id > -1) {
      message.data.lastblock    = this.app.options.blockchain.latest_block_id;
    }
    if (this.app.blockchain.returnLatestBlockId() > message.data.lastblock) {
      message.data.lastblock = this.app.blockchain.returnLatestBlockId();
    }

console.log(message);

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
  response.data.dns                      = [];
  response.data.publickey                = this.app.wallet.returnPublicKey();
  response.data.current_block_id         = this.app.blockchain.returnLatestBlockId();
  response.data.current_genesis_block_id = this.app.blockchain.returnGenesisBlockId();

  for (mdns = 0; mdns < this.app.modules.mods.length; mdns++) {
    if (this.app.modules.mods[mdns].isDomainRegistry == 1) {
      response.data.dns.push(this.app.modules.mods[mdns].domain);
    }
  }

  if (this.peer.publickey == "") {
    response.data.sendConnectReplyResponse = 1;
  } else {
    response.data.sendConnectReplyResponse = 0;
  }

  return response;

}
Peer.prototype.returnBlockchainRequest = function returnBlockchainRequest(type="full", block_id=0) {

  response                               = {};
  response.request                       = "blockchain";
  response.data                          = {};
  response.data.type                     = "full";
						// full = give me full blocks
						// lite = give me headers
  response.data.block_id		 = 0;
						// starting ID, or 0 for earliest
  response.data.keystowatch              = this.app.keys.returnPublicKeysWatchedArray();
  response.data.keystowatch.push(this.app.wallet.returnPublicKey());
  return response;

}







Peer.prototype.fetchBlockchain = function fetchBlockchain() {

  response = this.returnBlockchainRequest();
  this.sendRequest(response.request, response.data);
  
}

























///////////////////
// Sending Stuff //
///////////////////
//
// a rather brutal firehose of data at scale
// we need to improve the way we handle this
// but for now, this is what we get.
//
Peer.prototype.sendBlockchain = function sendBlockchain(starting_block_id, type="full", publickeylist=null) {

  // we might be sending a mega-ton of data, so fetch this information from 
  // our database and send it once that process has completed.
  console.log("SENDING BLOCKS FROM DATABASE STARTING WITH BLOCK: "+starting_block_id + " and type " + type);

  if (starting_block_id == null) { 
    tmpx = this.app.blockchain.returnLatestBlock();
    if (tmpx != null) {
      tmpx = tmpx.returnId()-10;
      if (tmpx < 0) { tmpx = 9; }
      starting_block_id = tmpx;  
    } else {
      starting_block_id = 0;
    }
  }



  if (type == "full") {

    peer_self = this;

    sql    = "SELECT * FROM blocks WHERE block_id >= $block_id";
    params = { $block_id : starting_block_id };
    this.app.storage.queryBlockchainArray(sql, params, function (err, rows) {
      for (rdr = 0; rdr < rows.length; rdr++) {
        row = rows[rdr];
        if (row.block != null) {
          //response = {};
          //response.request = "block";
          //response.data = row.block;
console.log("sending block "+row.id+"...");
          peer_self.sendRequest("block", row.block);
        }
      }
    });

    return;
  }
  if (type == "lite") {

    peer_self = this;

    sql    = "SELECT * FROM blocks WHERE block_id >= $block_id";
    params = { $block_id : starting_block_id };
    this.app.storage.queryBlockchainArray(sql, params, function (err, rows) {
      for (rdr = 0; rdr < rows.length; rdr++) {
        row = rows[rdr];
        if (row.block != null) {

          blk = new saito.block(peer_self.app, row.block);
	  var is_important_block = 1;

	  // in lite-mode we don't send the 
	  // transactions, but send everything
	  // else. nodes will not be able to 
	  // create blocks, but can still 
	  // follow longest blocks, etc.
	  //
	  // check to see if there is a transaction
          // in this block for this peer. If not
	  // just eliminate all transactions from
	  // the block as unnecessary
	  //
	  // either we check for this peer only, or 
	  // we process the list of requested public
	  // keys provided as the third pargument (optional)
	  // to this function
          if (publickeylist == null) {
	    // check only for our own messages
	    if (! blk.containsTransactionFor(peer_self.publickey)) {
	      is_important_block = 0;
	    }
	  } else {
	    is_important_block = 0;
	    for (itib = 0; itib < publickeylist.length && is_important_block == 0; itib++) {
	      if (blk.containsTransactionFor(publickeylist[itib])) {
	        is_important_block = 1; 
              }
            }
	    if (is_important_block == 0) {
  	      if (blk.containsTransactionFor(peer_self.publickey)) {
	        is_important_block = 1;
	      }
	    }
	  }
	  if (is_important_block == 0) {
	    blk.block.transactions = [];
	  }
          //response = {};
          //response.request = "block";
          //response.data = JSON.stringify(blk.block);
console.log("sending block lite-mode "+row.id+"...");
          peer_self.sendRequest("block", JSON.stringify(blk.block));

        }
      }
    });

    return;

  }

}


Peer.prototype.sendRequest = function sendRequest(message, data="") {

  // find out initial state of peer and blockchain
  var userMessage = {};
      userMessage.request  = message;
      userMessage.data     = data;


  // avoid sending unwelcome data
  if (this.sendblocks == 0       && message == "block")         { return; }
  if (this.sendtransactions == 0 && message == "transaction")   { return; }
  if (this.sendtickets == 0      && message == "golden ticket") { return; }

  // only send if we have an active connection
  if (this.socket != null) {
    if (this.socket.connected == true) {
      this.socket.emit('request',JSON.stringify(userMessage));
    }
  }

}
Peer.prototype.sendRequestWithCallback = function sendRequestWithCallback(message, data="", mycallback) {

  // find out initial state of peer and blockchain
  var userMessage = {};
      userMessage.request  = message;
      userMessage.data     = data;

  this.message_queue.push(JSON.stringify(userMessage));

}
Peer.prototype.sendQueuedRequest = function sendQueuedRequest() {

  if (this.message_queue.length > 0) {

    // only send if we have an active connection
    if (this.socket != null) {
      if (this.socket.connected == true) {
console.log("... sending queued request ... ");
        this.socket.emit('request',this.message_queue[0]);
	this.message_queue.splice(0, 1);
      }
    }

  }

}
Peer.prototype.isConnected = function isConnected() {

  if (this.socket != null) {
    if (this.socket.connected == true) {
      return 1;
    }
  }
  return 0;
}










/////////////////////
// Path Management //
/////////////////////
Peer.prototype.inTransactionPath = function inTransactionPath(tx) {
  if (tx.isFrom(this.peer.publickey)) {
    return 1;
  }
  for (zzz = 0; zzz < tx.transaction.path.length; zzz++) {
    if (tx.transaction.path[zzz].from == this.peer.publickey) {
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







