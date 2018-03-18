var saito        = require('../saito');
var io           = require('socket.io-client');
var util         = require('util');


function Peer(app, peerjson="") {

  if (!(this instanceof Peer)) {
    return new Peer(app, peerjson);
  }

  this.app = app || {};

  this.peer                  = {};
  this.peer.host             = "localhost";
  this.peer.port             = "12101";
  this.peer.publickey        = "";
  this.peer.speed            = null;
  this.peer.keylist          = [];		// only used with lite/spv modes
  this.peer.synctype         = "full"; 		// full = full blocks
						// lite = spv client

  if (this.app.SPVMODE == 1) { this.peer.synctype = "lite"; }

  // used by storage class
  this.sync_sending          = 0;
  this.sync_sending_chunk    = 0;
  this.sync_sending_bid      = 0;
  this.sync_latest_bid       = 0;
  this.sync_sending_db_bid   = 0;
  this.sync_timer            = null;
  this.sync_timer_speed      = 400;             // 0.4 seconds

  this.contact	   	     = 0;		// 0 - we initiated contact request
  this.disconnected          = 0;               // 1 - we were disconnected
  this.block_sync            = null;		// id of last block sent in initial sync

  this.sendblocks            = 1;
  this.sendtransactions      = 1;
  this.sendtickets           = 1;

  this.message_queue         = [];
  this.message_queue_speed   = 500;		// sent
  this.message_queue_timer   = null;
  this.socket                = null;
  this.socket_id             = null;

  if (peerjson != "") {
    this.peer = JSON.parse(peerjson);
    if (this.peer.speed != null) {
      this.message_queue_speed = this.peer.speed;
    }
  }

  this.startQueueTimer();

  return this;

}
module.exports = Peer;



Peer.prototype.addSocketEvents = function addSocketEvents() {

  var peer_self = this;

  /////////////
  // connect //
  /////////////
  // peer that initiated contact, initiates reconnection
  this.socket.on('connect', function(){
    console.log("client connect");
    if (peer_self.contact == 0) {
      if (peer_self.disconnected == 1) {
        var message = peer_self.returnConnect();
        peer_self.socket.emit('request',JSON.stringify(message));
      } 
    }
  });
  this.socket.on('event', function(){});
  this.socket.on('disconnect', function(){
    console.log("client disconnect");
    peer_self.disconnected = 1;
  });


  ///////////////////
  // peer requests //
  ///////////////////
  this.socket.on('request', function (data, mycallback=null) {

    var message  = JSON.parse(data.toString());
    var response = {}

    /////////////////////
    // module callback //
    /////////////////////
    peer_self.app.modules.handlePeerRequest(message, peer_self, mycallback);

    /////////////
    // connect //
    /////////////
    if (message.request == "connect") {

      peer_self.contact        	    = 1; // i received connect request
      peer_self.disconnected   	    = 0;
      peer_self.sendblocks          = message.data.sendblocks;
      peer_self.sendtransactions    = message.data.sendtransactions;
      peer_self.sendtickets         = message.data.sendtickets;

      if (message.data.speed > 0)   { peer_self.peer.speed = message.data.speed; }
      peer_self.peer.publickey 	    = message.data.publickey;
      peer_self.peer.keylist        = message.data.keylist;
      peer_self.peer.synctype       = message.data.synctype;

      var my_last_blk               = peer_self.app.blockchain.returnLatestBlock();
      var my_last_bid               = 0;
      var peer_last_bid  	    = message.data.lastblock;
      var peer_fid       	    = message.data.forkid;
      var synctype       	    = peer_self.peer.synctype;


      // if a lastblockid has been submitted along with a forkid we can earmark
      // which blocks to send. this avoids nodes requesting blocks AFTER they
      // self-generate a fork.
      var bid_from_fid = peer_self.app.blockchain.returnLastSharedBlockId(peer_fid, peer_last_bid);
      if (bid_from_fid < peer_last_bid) {
	if (peer_self.peer.synctype == "full") {
	  peer_last_bid = bid_from_fid; 
	}
      }

      if (my_last_blk != null) { my_last_bid = my_last_blk.returnId(); }

      // a blockid of 0 in a lite client doesnt mean sync from scratch
      if (peer_last_bid == 0 && peer_self.peer.synctype == "lite") {
        peer_last_bid = "";
      }

      // lite-sync feed out last 10 blocks. full-sync gets everything
      //
      // if we change lite-sync to > 10, be sure to change the 
      // setting in saito.wallet to check a greater portion of
      // the utxi set.
      if (peer_self.peer.synctype == "lite") {
        if (peer_last_bid === "" || peer_last_bid == 0) {
          var start_bid = my_last_bid-10;
          if (start_bid < 0) { start_bid = 0; }
          peer_self.sendBlockchain(start_bid, synctype);
        } else {
          peer_self.sendBlockchain(peer_last_bid, synctype);
        }
      } else {
        if (peer_last_bid === "") {
          peer_self.sendBlockchain(0, synctype);
        } else {
          peer_self.sendBlockchain(peer_last_bid, synctype);
        }
      }
      return;
    }


    //////////////////////////////////////
    // other server is at full capacity //
    //////////////////////////////////////
    if (message.request == "connect-deny") {
      this.socket = null;
      this.app.network.cleanupDisconnectedSocket(this);
      return;
    }


    //////////////////////////
    // connection handshake //
    //////////////////////////
    if (message.request == "connect-reply") {

      peer_self.peer.publickey = message.data.publickey;

      for (var v = 0; v < message.data.dns.length; v++) {
        peer_self.app.dns.addDomain(message.data.dns[v], peer_self.peer.publickey);
      }

      var my_last_bid         = peer_self.app.blockchain.returnLatestBlockId();
      var their_last_block_id = message.data.current_block_id;
      var their_fork_id       = message.data.current_fork_id;

      if (their_last_block_id < my_last_bid) {
        if (peer_self.peer.synctype == "lite") {
          peer_self.sendBlockchain(their_last_block_id, synctype);
        } else {
          if (peer_self.app.BROWSER == 0 && peer_self.app.SPVMODE == 0) {
            peer_self.sendBlockchain(their_last_block_id, synctype);
	  }
        }
      }

      if (peer_self.peer.synctype == "lite" && message.data.synctype == "full") { peer_self.peer.synctype = "lite"; }

      peer_self.app.storage.saveOptions();
      return;
    }


    ////////////////////
    // missing blocks //
    ////////////////////
    if (message.request == "missing block") {
      var tmpr = JSON.parse(message.data);
      peer_self.app.storage.propagateMissingBlock(tmpr.hash, peer_self);
      if (mycallback != null) { mycallback(); }
      return;
    }


    ////////////
    // blocks //
    ////////////
    if (message.request == "block") {
      if (peer_self.peer.synctype == "full") {
        // blockchain propagates after validation
        peer_self.app.blockchain.importBlock(message.data);
      } else {
        // lite blocks not relayed
        peer_self.app.blockchain.importBlock(message.data, 0);
      }
      return;
    }


    /////////////////////
    // block available //
    /////////////////////
    if (message.request == "block available") {
      if (message.data == null) { return; }
      if (message.data.block_filename == null) { return; }
      if (message.data.block_hash == null) { return; }
      var block_filename = message.data.block_filename;
      var block_hash     = message.data.block_hash;
      peer_self.app.blockchain.mempool.fetchBlock(peer_self, block_filename, block_hash);
      return;
    }







    //////////////////
    // transactions //
    //////////////////
    if (message.request == "transaction") {
      var tx = new saito.transaction(message.data);
      peer_self.app.blockchain.mempool.importTransaction(message.data);
      if (mycallback != null) { mycallback(); }
      return;
    }


    ////////////////////
    // golden tickets //
    ////////////////////
    if (message.request == "golden ticket") {
      var tx = new saito.transaction(message.data);
      peer_self.app.network.propagateGoldenTicket(tx);
      peer_self.app.blockchain.mempool.importTransaction(message.data);
      return;
    }


    ////////////////
    // blockchain //
    ////////////////
    if (message.request == "blockchain") {
      peer_self.sendBlockchain(message.data.block_id, message.data.synctype);
      return;
    }


    //////////////////
    // dns requests //
    //////////////////
    if (message.request == "dns") {
      peer_self.app.modules.handleDomainRequest(message, peer_self, mycallback);
    }

  });
}





//////////////////////////
// Connection Managment //
//////////////////////////
//
// remote is set to "remote-originated-connection"
// for connection attempts started remotely
//
Peer.prototype.connect = function connect(remote = 0) {

  var peer_self = this;

  // this is triggered if we are initializing 
  // a connection to a remote server
  if (remote == 0) {

    // avoid connecting to myself
    if (this.peer.host == "localhost" && this.app.BROWSER == 0) { return; }
    if (this.peer.host == "localhost" && this.app.BROWSER == 1) { }
    if (this.peer.host == this.app.options.server.host && this.app.BROWSER == 0) { return; }

    var serverAddress = "http://"+this.peer.host+":"+this.peer.port;

    var socket = io(serverAddress);
    this.socket = socket;

    // affix this socket to our events
    this.addSocketEvents();
    var message = null;
    if (this.app.wallet.returnBalance() < 10) {
      message = this.returnConnect(1);
    } else {
      message = this.returnConnect();
    }
    socket.emit('request',JSON.stringify(message));

  } else {

    // here we respond to a connection attempt
    // by confirming we have all of the information
    // we need about the remote host
    var response = this.returnConnectResponse();
    this.socket.emit('request',JSON.stringify(response));

  }
}
//
// request_tokens is whether we want the server to give us some credit
// (servers can ignore this).
//
Peer.prototype.returnConnect = function returnConnect(request_tokens = 0) {

	if (this.sendtransactions == 0) { request_tokens = 0; }
	if (this.sendblocks == 0)       { request_tokens = 0; }
	if (this.sendtickets == 0)      { request_tokens = 0; }

	var message = {};
	    message.encrypted             = "no";
	    message.request               = "connect";
	    message.data                  = {};
	    message.data.lastblock        = "";
	    message.data.forkid           = "";
	    message.data.speed            = this.peer.speed;
	    message.data.request_tokens   = request_tokens;
	    message.data.info             = this.sendtransactions + " / " + this.sendblocks + " / " + this.sendtickets;
	    message.data.sendtransactions = this.sendtransactions;
	    message.data.sendblocks       = this.sendblocks;
	    message.data.sendtickets      = this.sendtickets;
	    message.data.keylist          = this.app.keys.returnWatchedPublicKeys();
	    message.data.keylist.push(this.app.wallet.returnPublicKey());
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
	if (this.app.options.blockchain.fork_id != null) {
	    message.data.forkid    = this.app.options.blockchain.fork_id;
        }

	return message;
}
Peer.prototype.returnConnectResponse = function returnConnectResponse() {

  var response                               = {};
  response.request                       = "connect-reply";
  response.data                          = {};
  response.data.dns                      = [];
  response.data.publickey                = this.app.wallet.returnPublicKey();
  response.data.synctype                 = this.peer.synctype;
  response.data.current_block_id         = this.app.blockchain.returnLatestBlockId();
  response.data.current_fork_id          = this.app.blockchain.returnForkId();
  response.data.current_genesis_block_id = this.app.blockchain.returnGenesisBlockId();

  for (var mdns = 0; mdns < this.app.modules.mods.length; mdns++) {
    if (this.app.modules.mods[mdns].isDomainRegistry == 1) {
      response.data.dns.push(this.app.modules.mods[mdns].domain);
    }
  }

  response.data.sendConnectReplyResponse = 1;

  return response;

}
Peer.prototype.returnBlockchainRequest = function returnBlockchainRequest(type="full", block_id=0) {
  var response                           = {};
  response.request                       = "blockchain";
  response.data                          = {};
  response.data.type                     = type;
  response.data.block_id		 = block_id;
  response.data.keylist                  = this.app.keys.returnWatchedPublicKeys();
  response.data.keylist.push(this.app.wallet.returnPublicKey());
  return response;
}
Peer.prototype.fetchBlockchain = function fetchBlockchain() {
  var response = this.returnBlockchainRequest();
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
Peer.prototype.sendBlockchain = function sendBlockchain(start_bid, type="full") {

  console.log("SENDING BLOCKS FROM DATABASE STARTING WITH BLOCK: "+start_bid + " and type " + type);

  if (start_bid == null) { 
    var tmpx = this.app.blockchain.returnLatestBlock();
    if (tmpx != null) {
      tmpx = tmpx.returnId()-10;
      if (tmpx < 0) { tmpx = 9; }
      start_bid = tmpx;  
    } else {
      start_bid = 0;
    }
  }

  this.app.storage.sendBlockchain(start_bid, type, this);

}


Peer.prototype.sendBlock = function sendBlock(message, blk, instant=0) {

  // find out initial state of peer and blockchain
  var userMessage = {};
      userMessage.request  = message;
      userMessage.data     = "";

  // avoid sending unwelcome data
  if (this.sendblocks == 0       && message == "block")         { return; }

  var original_transactions = blk.block.transactions;

  // lite-clients
  if (this.peer.synctype == "lite") {

    var is_important_block = 1;

    // check to see if there is a transaction
    // in this block for this peer. If not
    // just eliminate all transactions from
    // the block.
    // 
    // also check for watchedeys
    if (this.peer.keylist.length == 0) {
      if (! blk.containsTransactionFor(this.peer.publickey)) {
        is_important_block = 0;
      } 
    } else {
      is_important_block = 0;
      for (var itib = 0; itib < this.peer.keylist.length && is_important_block == 0; itib++) {
        if (blk.containsTransactionFor(this.peer.keylist[itib])) {
          is_important_block = 1; 
        } 
      } 
      if (is_important_block == 0) {
        if (blk.containsTransactionFor(this.peer.publickey)) {
          is_important_block = 1;
        } 
      } 
    } 
    if (is_important_block == 0) {
      blk.block.transactions = [];
    } 
    userMessage.data = JSON.stringify(blk.block);
  } else {

    // for FULL NODES we notify of blocks rather than SEND
    userMessage.request = "block available";
    userMessage.data    = {};
    userMessage.data.block_filename = blk.pmt_filename;
    userMessage.data.block_hash = blk.returnHash();

  }


  // restore original block
  blk.block.transactions = original_transactions;


  if (instant == 1) {
    if (this.socket != null) {
      if (this.socket.connected == true) {
        this.socket.emit('request',JSON.stringift(userMessage));
      }
    }
  } else {
    this.message_queue.push(JSON.stringify(userMessage));
    if (this.socket != null) {
      if (this.socket.connected != true) {
        this.app.network.cleanupDisconnectedSocket(this);
        return;
      }
    } else {
      this.app.network.cleanupDisconnectedSocket(this);
      return;
    }
  }

}
Peer.prototype.sendRequest = function sendRequest(message, data="", instant=0) {

  // find out initial state of peer and blockchain
  var userMessage = {};
      userMessage.request  = message;
      userMessage.data     = data;

  // avoid sending unwelcome data
  if (this.sendblocks == 0       && message == "block")         { return; }
  if (this.sendtransactions == 0 && message == "transaction")   { return; }
  if (this.sendtickets == 0      && message == "golden ticket") { return; }

  if (instant == 1) {
    if (this.socket != null) {
      if (this.socket.connected == true) {
        this.socket.emit('request',JSON.stringift(userMessage));
      }
    }
  } else {
    this.message_queue.push(JSON.stringify(userMessage));
    if (this.socket != null) {
      if (this.socket.connected != true) {
        this.app.network.cleanupDisconnectedSocket(this);
        return;
      }
    } else {
      this.app.network.cleanupDisconnectedSocket(this);
      return;
    }
  }

}

// this request ignores sendblocks / sendtransactions / sendtickets
Peer.prototype.sendRequestWithCallback = function sendRequestWithCallback(message, data="", mycallback) {

  // find out initial state of peer and blockchain
  var userMessage = {};
      userMessage.request  = message;
      userMessage.data     = data;

  // only send if we have an active connection
  if (this.socket != null) {
    if (this.socket.connected == true) {
      this.socket.emit('request',JSON.stringify(userMessage), mycallback);
      return;
    }
  }

  tmperr = {}; tmperr.err = "peer not connected";
  mycallback(tmperr);

}
Peer.prototype.startQueueTimer = function startQueueTimer(timer_speed=1) {

  var peer_self = this;

  if (timer_speed != 1) {
    this.message_queue_timer = setInterval(function() {
      peer_self.sendQueuedRequest();
    }, timer_speed);
  } else {
    // init queue timer
    if (this.message_queue_timer == null) {
      this.message_queue_timer = setInterval(function() {
        peer_self.sendQueuedRequest();
      }, this.message_queue_speed);
    }
  }
}
Peer.prototype.sendQueuedRequest = function sendQueuedRequest() {

  if (this.message_queue.length > 0) {
    // only send if we have an active connection
    if (this.socket != null) {
      if (this.socket.connected == true) {
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
  for (var zzz = 0; zzz < tx.transaction.path.length; zzz++) {
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


