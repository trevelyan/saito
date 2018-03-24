var saito         = require('../saito');

function Transaction(txjson="") {

  if (!(this instanceof Transaction)) {
    return new Transaction(txjson);
  }

  /////////////////////////
  // consensus variables //
  /////////////////////////
  this.transaction               = {};
  this.transaction.id            = 1;
  this.transaction.from          = [];
  this.transaction.to            = [];
  this.transaction.ts            = "";
  this.transaction.sig           = ""; 
  this.transaction.ver           = 1.0;
  this.transaction.path          = [];
  this.transaction.gt            = null;
  this.transaction.ft            = null;
  this.transaction.msg           = {};
  this.transaction.msig          = "";
  this.transaction.ps            = 0;
  this.transaction.rb            = 0;  // 0  = do not rebroadcast
				       // 1+ = num of current broadcast

  ///////////////////
  // non-consensus //
  ///////////////////
  this.decrypted_msg             = "";
  this.usable_fee                = -1;
  this.fee                       = -1;


  /////////////////
  // import json //
  /////////////////
  if (txjson != "") {
    this.transaction = JSON.parse(txjson);
    if (this.transaction.from == null) { this.transaction.from = []; }
    if (this.transaction.to == null)   { this.transaction.to = []; }
    for (var txi = 0; txi < this.transaction.from.length; txi++) {
      this.transaction.from[txi] = new saito.slip(this.transaction.from[txi].add, this.transaction.from[txi].amt, this.transaction.from[txi].gt, this.transaction.from[txi].bid, this.transaction.from[txi].tid, this.transaction.from[txi].sid, this.transaction.from[txi].bhash, this.transaction.from[txi].lc, this.transaction.from[txi].ft, this.transaction.from[txi].rn);
    }
    for (var txi = 0; txi < this.transaction.to.length; txi++) {
      this.transaction.to[txi] = new saito.slip(this.transaction.to[txi].add, this.transaction.to[txi].amt, this.transaction.to[txi].gt, this.transaction.to[txi].bid, this.transaction.to[txi].tid, this.transaction.to[txi].sid, this.transaction.to[txi].bhash, this.transaction.to[txi].lc, this.transaction.to[txi].ft, this.transaction.to[txi].rn);
    }
  }

  return this;

}
module.exports = Transaction;





Transaction.prototype.addFrom = function addFrom(fromAddress, fromAmount) {
  this.from.push(new saito.slip(fromAddress, fromAmount));
}
Transaction.prototype.addTo = function addTo(toAddress, toAmount) {
  this.to.push(new saito.slip(toAddress, toAmount));
}
Transaction.prototype.decryptMessage = function decryptMessage(app) {
  // try-catch avoids errors decrypting non-encrypted content
  try {
    var x = app.keys.decryptMessage(this.transaction.from[0].add, this.transaction.msg);
    this.decrypted_msg = x;
  } catch (e) {
    this.decrypted_msg = this.transaction.msg;
  }
  return;
}
Transaction.prototype.involvesPublicKey = function involvesPublicKey(publickey) {
  if (this.returnSlipsFrom(publickey).length > 0 || this.returnSlipsTo(publickey).length > 0 ) { return 1; }
  return 0;
}
Transaction.prototype.isGoldenTicket = function isGoldenTicket(senderPublicKey) {
  if (this.transaction.gt != null) { return 1; }
  return 0;
}
Transaction.prototype.isFeeTransaction = function isFeeTransaction() {
  if (this.transaction.ft != 1) { return 0; }
  return 1;
}
Transaction.prototype.isFrom = function isFrom(senderPublicKey) {
  if (this.returnSlipsFrom(senderPublicKey).length != 0) { return 1; }
  return 0;
}
Transaction.prototype.isTo = function isTo(receiverPublicKey) {
  if (this.returnSlipsTo(receiverPublicKey).length != 0) { return 1; }
  return 0;
}
Transaction.prototype.returnAmountTo = function returnAmountTo(toAddress) {
  var x = 0.0;
  if (this.transaction.to != null) {
    for (var v = 0; v < this.transaction.to.length; v++) {
      if (this.transaction.to[v].add == toAddress) {
        if (this.transaction.to[v].amt > 0) { x = parseFloat(x) + parseFloat(this.transaction.to[v].amt); }
      }
    }
  }
  return x;
}
Transaction.prototype.returnFeeUsable = function returnFeeUsable() {

  if (this.usable_fee == -1 || this.usable_fee == null) {

    var inputs = 0.0;
    if (this.transaction.from != null) {
      for (var v = 0; v < this.transaction.from.length; v++) {
        inputs = parseFloat(inputs) + parseFloat(this.transaction.from[v].amt);
      }
    }

    var outputs = 0.0;
    for (var v = 0; v < this.transaction.to.length; v++) {
      // only count outputs on non-gt transactions
      if (this.transaction.to[v].gt != 1) {
        outputs = parseFloat(outputs) + parseFloat(this.transaction.to[v].amt);
      }
    }

    this.fee = (inputs - outputs);
    this.usable_fee = this.fee;

    var pathlength = this.returnPathLength();

    for (var x = 1; x < pathlength; x++) {
      this.usable_fee = this.fee/2;
      this.usable_fee.toFixed(8);
    }

    return this.usable_fee;
  } else {
    return this.usable_fee;
  }
}
Transaction.prototype.returnFeeTotal = function returnFeeTotal() {

  if (this.fee == -1 || this.fee == null) {

    var inputs = 0.0;
    for (var v = 0; v < this.transaction.from.length; v++) {
      inputs = parseFloat(inputs) + parseFloat(this.transaction.from[v].amt);
    }

    var outputs = 0.0;
    for (var v = 0; v < this.transaction.to.length; v++) {
      // only count outputs on non-gt transactions
      if (this.transaction.to[v].gt != 1) {
        outputs = parseFloat(outputs) + parseFloat(this.transaction.to[v].amt);
      }
    }

    this.fee = (inputs - outputs);
  }

  return this.fee;
}
Transaction.prototype.returnId = function returnId() {
  return this.transaction.id;
}
Transaction.prototype.returnMessageSignatureSource = function returnMessageSignatureSource() {
  return JSON.stringify(this.transaction.msg);
}
Transaction.prototype.returnSignatureSource = function returnSignatureSource() {
  return JSON.stringify(this.transaction.from) + 
         JSON.stringify(this.transaction.to) + 
         this.transaction.ts +
         this.transaction.ps +
         this.transaction.rb +
         JSON.stringify(this.transaction.gt) +
         JSON.stringify(this.transaction.ft) +
         JSON.stringify(this.transaction.msig);
}
Transaction.prototype.returnSlipsTo = function returnSlipsTo(toAddress) {
  var x = [];
  if (this.transaction.to != null) {
    for (var v = 0; v < this.transaction.to.length; v++) {
      if (this.transaction.to[v].add == toAddress) { x.push(this.transaction.to[v]); }
    }
  }
  return x;
}
Transaction.prototype.returnSlipsFrom = function returnSlipsFrom(fromAddress) {
  var x = [];
  if (this.transaction.from != null) {
    for (var v = 0; v < this.transaction.from.length; v++) {
      if (this.transaction.from[v].add == fromAddress) { x.push(this.transaction.from[v]); }
    }
  }
  return x;
}
Transaction.prototype.returnTransactionJson = function returnTransactionJson() {
  return JSON.stringify(this.returnTransaction());
}
Transaction.prototype.returnTransaction = function returnTransaction() {
  return this.transaction;
}
Transaction.prototype.returnPathLength = function returnPathLength() {
  return this.transaction.path.length;
}
Transaction.prototype.returnSender = function returnSender() {
  if (this.transaction.from.length >= 1) {
    return this.transaction.from[0].add;
  }
}
Transaction.prototype.signMessage = function signMessage(message) {
  return saito.crypt().signMessage(message, this.app.wallet.returnPrivateKey());
}
Transaction.prototype.signTransaction = function signTransaction() {
  this.transaction.msig   = this.signMessage(this.transaction.msg);
  this.transaction.sig  = this.signMessage(this.returnSignatureSource());
}
Transaction.prototype.validate = function validate(app, paysplit_vote=0, block_id=0) {

  // validate votes
  if (paysplit_vote == 1) {
    if (this.transaction.ps != 1 && this.transaction.gt != null) {
      console.log("transaction paysplit vote differs from block paysplit vote");
      app.blockchain.mempool.removeTransaction(this);
      return 0;
    }
  }
  if (paysplit_vote == -1) {
    if (this.transaction.ps != -1 && this.transaction.gt != null) {
      console.log("transaction paysplit vote differs from block paysplit vote");
      app.blockchain.mempool.removeTransaction(this);
      return 0;
    }
  }


  // check all inputs save gt/ft within genesis period
  var acceptable_lower_block_limit = block_id-app.blockchain.returnGenesisPeriod();
  for (var tidx = 0; tidx < this.transaction.from.length; tidx++) {
    if (this.transaction.from[tidx].bid < acceptable_lower_block_limit && this.transaction.ft != 1 && this.transaction.from[tidx].gt != 1) {
      console.log("transaction outdated: tries to spend input from block "+this.transaction.from[tidx].bid);
      console.log(this.transaction.from[tidx]); 
      app.blockchain.mempool.removeTransaction(this);
      return 0;
    }
  }


  // at least one sender and receiver
  if (this.transaction.from.length < 1) { 
    console.log("no from address in transaction");
    app.blockchain.mempool.removeTransaction(this);
    return 0;
  }
  if (this.transaction.to.length < 1) { 
    console.log("no to address in transaction");
    app.blockchain.mempool.removeTransaction(this);
    return 0;
  }


  if (!saito.crypt().verifyMessage(this.returnSignatureSource(),this.transaction.sig,this.returnSender())) {
    console.log("transaction signature does not verify");
    app.blockchain.mempool.removeTransaction(this);
    return 0;
  }

  if (!saito.crypt().verifyMessage(this.returnMessageSignatureSource(),this.transaction.msig,this.returnSender())) {
    console.log("transaction message signature does not verify");
    app.blockchain.mempool.removeTransaction(this);
    return 0;
  }

  return 1;

}

