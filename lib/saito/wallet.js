var saito = require('../saito');



/////////////////
// Constructor //
/////////////////
function Wallet(app, walletjson="") {

  if (!(this instanceof Wallet)) {
    return new Wallet(app, walletjson);
  }

  this.app     = app || {};

  this.wallet               = {};
  this.wallet.balance       = parseFloat(0.0);
  this.wallet.privateKey    = "";
  this.wallet.publicKey     = "";
  this.wallet.identifier    = "";
  this.wallet.utxi          = [];
  this.wallet.utxo          = [];
  this.wallet.version       = 1.40;

  this.spent_slips          = [];

  return this;

}
module.exports = Wallet;



//////////////////
// Reset Wallet //
//////////////////
Wallet.prototype.resetWallet = function resetWallet() {
  this.wallet.privateKey = "";
  this.wallet.publicKey  = "";
  this.wallet.identifier = "";
  this.wallet.balance    = parseFloat(0.0);
  this.wallet.utxi       = [];
  this.wallet.utxo       = [];
}
Wallet.prototype.resetSpentInputs = function resetSpentInputs() {
  for (var i = 0; i < this.wallet.utxi.length; i++) { 
    this.spent_slips[i] = 0; 
  }
}



////////////////
// Initialize //
////////////////
Wallet.prototype.initialize = function initialize() {

  if (this.wallet.privateKey == "") {
    if (this.app.options.wallet != null) {
      if (this.app.options.wallet.version != this.wallet.version) {
	if (this.app.BROWSER == 1) {

          this.app.options.wallet.version = this.wallet.version;

          var tmpprivkey = this.app.options.wallet.privateKey;
          var tmppubkey  = this.app.options.wallet.publicKey;
          var tmpid      = this.app.options.wallet.identifier;

          this.app.storage.saveOptions(1); // 1 = reset 
          this.app.archives.resetArchives();

          this.wallet.publicKey  = tmppubkey;
          this.wallet.privateKey = tmpprivkey;
          this.wallet.identifier = tmpid;

  	  this.app.options.blockchain.lastblock = "";
	  this.app.storage.saveOptions();

          this.saveWallet();

          alert("Saito Upgrade: Wallet Reset");

        }
      }
      this.wallet = this.app.options.wallet;
    }
    if (this.wallet.privateKey == "") {
      this.generateKeys();
      this.app.storage.saveOptions();
    }
  }

  // import slips
  if (this.app.options.wallet != null) {
    if (this.app.options.wallet.utxi != null) {
      for (var i = 0; i < this.app.options.wallet.utxi.length; i++) {
        this.wallet.utxi[i] = new saito.slip(
		this.app.options.wallet.utxi[i].add,
		this.app.options.wallet.utxi[i].amt,
		this.app.options.wallet.utxi[i].gt,
		this.app.options.wallet.utxi[i].bid,
		this.app.options.wallet.utxi[i].tid,
		this.app.options.wallet.utxi[i].sid,
		this.app.options.wallet.utxi[i].bhash,
		this.app.options.wallet.utxi[i].lc,
		this.app.options.wallet.utxi[i].ft
	);
	this.spent_slips[i] = 0;
      }
    }
    if (this.app.options.wallet.utxo != null) {
      for (var i = 0; i < this.app.options.wallet.utxo.length; i++) {
        this.wallet.utxo[i] = new saito.slip(
		this.app.options.wallet.utxo[i].add,
		this.app.options.wallet.utxo[i].amt,
		this.app.options.wallet.utxo[i].gt,
		this.app.options.wallet.utxo[i].bid,
		this.app.options.wallet.utxo[i].tid,
		this.app.options.wallet.utxo[i].sid,
		this.app.options.wallet.utxo[i].bhash,
		this.app.options.wallet.utxo[i].lc,
		this.app.options.wallet.utxo[i].ft
	);
      }
    }
  }

  this.purgeExpiredSlips();

}



//////////////////////
// Crypto Functions //
//////////////////////
Wallet.prototype.signTransaction = function signTransaction(tx) {
  if (tx == null) { return null; }
  for (var i = 0; i < tx.transaction.to.length; i++) {
    tx.transaction.to[i].sid = i;
  }
  tx.transaction.msig   = this.signMessage(tx.messageSignatureSource());
  tx.transaction.sig    = this.signMessage(tx.signatureSource());
  return tx;
}
Wallet.prototype.signMessageWithForeignKey = function signMessageWithForeignKey(msg, foreign_key) {
  return saito.crypt().signMessage(msg, foreign_key);
}
Wallet.prototype.signMessage = function signMessage(msg) {
  return saito.crypt().signMessage(msg, this.wallet.privateKey);
}
Wallet.prototype.verifyMessage = function verifyMessage(msg, sig, pubkey) {
  return saito.crypt().verifyMessage(msg, sig, pubkey);
}
Wallet.prototype.generateKeys = function generateKeys() {
  this.wallet.privateKey = this.app.crypt.generateKeys();
  this.wallet.publicKey  = this.app.crypt.returnPublicKey(this.wallet.privateKey);
  this.app.storage.saveOptions();
}



/////////////////////
// Slip Management //
/////////////////////
Wallet.prototype.addInput = function addInput(x) {
  this.wallet.utxi.push(x);
  this.spent_slips.push(0);
}
Wallet.prototype.purgeExpiredSlips = function purgeExpiredSlips() {
  var gid = this.app.blockchain.returnGenesisBlockId();
  for (var m = this.wallet.utxi.length-1; m >= 0; m--) {
    if (this.wallet.utxi[m].bid < gid) {
      this.wallet.utxi.splice(m, 1);
      this.spent_slips.splice(m, 1);
    }
  }
}
Wallet.prototype.getAvailableInputs = function getAvailableInputs() {

  var value   = 0.0;

  var lowest_block = this.app.blockchain.returnLatestBlockId() - this.app.blockchain.returnGenesisPeriod();
      // +2 is just a safeguard  (+1 because is next block, +1 for safeguard)
      lowest_block = lowest_block+2;

  this.purgeExpiredSlips();

  for (var i = 0; i < this.wallet.utxi.length; i++) {
    if (this.wallet.utxi[i].lc == 1 && this.wallet.utxi[i].bid >= lowest_block) {
      if (this.spent_slips[i] == 0) {
        value += parseFloat(this.wallet.utxi[i].amt) + parseFloat(value);
      }
    }
  }
  return value;

}
Wallet.prototype.getAdequateInputs = function getAdequateInputs(amt) {

  var utxiset = [];
  var value   = 0.0;

  var lowest_block = this.app.blockchain.returnLatestBlockId() - this.app.blockchain.returnGenesisPeriod();
      // +2 is just a safeguard  (+1 because is next block, +1 for safeguard)
      lowest_block = lowest_block+2;

  this.purgeExpiredSlips();

  for (var i = 0; i < this.wallet.utxi.length; i++) {
    if (this.wallet.utxi[i].lc == 1 && this.wallet.utxi[i].bid >= lowest_block) {
      if (this.spent_slips[i] == 0) {
        this.spent_slips[i] = 1;
        utxiset.push(this.wallet.utxi[i]);
        value = parseFloat(this.wallet.utxi[i].amt) + parseFloat(value);
        if (value >= amt) { return utxiset; }
      }
    }
  }
  return null;
}



///////////////////////////
// Generate Transactions //
///////////////////////////
//
// create a normal transaction
//
Wallet.prototype.createSignedTransactionWithForeignKey = function createSignedTransactionWithForeignKey(to, send_amt = 0.0, slip_address, slip_amt, slip_bid, slip_tid, slip_sid, slip_bhash, slip_publickey, slip_privatekey, tx_msg) {

  var tx = new saito.transaction();
      tx.transaction.msg = tx_msg;
      tx.transaction.ts   = new Date().getTime();

  // recreate FROM slip
  var fslip       = new saito.slip();
      fslip.add   = slip_address;
      fslip.amt   = slip_amt;
      fslip.bid   = slip_bid;
      fslip.tid   = slip_tid;
      fslip.sid   = slip_sid;
      fslip.bhash = slip_bhash;
      fslip.lc    = 1;
      fslip.ft    = 0;

  // create new TO slip
  var tslip       = new saito.slip(to, send_amt);

  tx.transaction.from.push(fslip);
  tx.transaction.to.push(tslip);
  tx.transaction.msg = tx_msg;

  // sign transaction
  for (var i = 0; i < tx.transaction.to.length; i++) {
    tx.transaction.to[i].sid = i;
  }
  tx.transaction.msig   = this.signMessageWithForeignKey(tx.messageSignatureSource(), slip_privatekey);
  tx.transaction.sig    = this.signMessageWithForeignKey(tx.signatureSource(), slip_privatekey);
  return tx;

}
Wallet.prototype.createUnsignedTransaction = function createUnsignedTransaction(to, amt = 0.0, fee = 0.0) {

  var tx = new saito.transaction();

  var total_fees = parseFloat(amt) + parseFloat(fee);
  if (total_fees > this.returnBalance()) { return null; }

  tx.transaction.from = this.getAdequateInputs(total_fees);
  tx.transaction.ts   = new Date().getTime();
  tx.transaction.to.push(new saito.slip(to, amt));

  if (tx.transaction.from == null) { return null; }

  // add change input
  var total_inputs = 0.0;
  if (fee > 0) {
    for (var i = 0; i < tx.transaction.from.length; i++) {
      total_inputs = parseFloat(total_inputs) + parseFloat(tx.transaction.from[i].amt);
    }
  }
  var change_amount = (parseFloat(total_inputs)-parseFloat(total_fees));
  if (change_amount > 0) {
    tx.transaction.to.push(new saito.slip(this.returnPublicKey(), change_amount));
  }

  return tx;

}
//
// create transaction for coinbase fees
//
Wallet.prototype.createFeeTransaction = function createFeeTransaction(my_fee) {

  var fslip = new saito.slip(this.returnPublicKey(), 0.0, 0); 
  fslip.ft = 1;

  var tx = new saito.transaction();
  tx.transaction.from.push(fslip);

  tslip = new saito.slip(this.returnPublicKey(), my_fee, 0);
  tx.transaction.to.push(tslip);

  tx.transaction.ts  = new Date().getTime();
  tx.transaction.msg = "fees";
  tx.transaction.ft  = 1;

  tx = this.signTransaction(tx);

  return tx;

}
//
// create transaction for golden tickets
//
Wallet.prototype.createGoldenTransaction = function createGoldenTransaction(winners, solution) {

  var tx = new saito.transaction();
  tx.transaction.from.push(new saito.slip(this.returnPublicKey(), 0.0, 1));

  tx.transaction.to.push(winners[0]);
  tx.transaction.to.push(winners[1]);
  tx.transaction.ts  = new Date().getTime();
  tx.transaction.gt  = solution;
  tx.transaction.msg = "golden ticket";

  tx = this.signTransaction(tx);

  return tx;

}



///////////////////////
// Handling Payments //
///////////////////////
//
// this function is called when payments are found
// for us in blocks that arrive over the network
//
// this is where we add slips to our wallet and where
// we remove ones that have been spent.
//
Wallet.prototype.paymentConfirmation = function paymentConfirmation(blk, tx, lchain) {

  this.purgeExpiredSlips();

  // inbound
  if (tx.isTo(this.returnPublicKey())) {
    var slips = tx.returnSlipsTo(this.returnPublicKey());
    for (var m = 0; m < slips.length; m++) {

      var s       = new saito.slip(slips[m].add, slips[m].amt, slips[m].gt);
          s.bhash = blk.hash();
          s.bid   = blk.block.id;
          s.tid   = tx.transaction.id;
          s.sid   = slips[m].sid;
          s.lc    = lchain;
	  s.ft    = slips[m].ft;
      if (s.amt > 0) { 
        if (this.containsUtxi(s) == 0) {
	  if (this.containsUtxo(s) == 0) {
	    this.wallet.utxi.push(s);
	    this.spent_slips.push(0);
	    this.wallet.balance = this.calculateBalance();
	  }
        } else {
	  for (var x = 0; x < this.wallet.utxi.length; x++) {
	    var t = this.wallet.utxi[x];
	    if (t.bhash == s.bhash && t.bid == s.bid && t.tid == s.tid && t.sid == s.sid && lchain == 1) {
	      this.wallet.utxi[x].lc = lchain;
	    }
	  }
	}
      }
    }
  }


  // outbound
  if (tx.isFrom(this.returnPublicKey()) && tx.transaction.gt == null) {
    var slips = tx.returnSlipsFrom(this.returnPublicKey());
    for (var m = 0; m < slips.length; m++) {
      var s = slips[m];
      for (var c = 0; c < this.wallet.utxi.length; c++) {
        var qs = this.wallet.utxi[c];
        if (
	  s.bid   == qs.bid &&
	  s.tid   == qs.tid &&
	  s.sid   == qs.sid &&
	  s.bhash == qs.bhash &&
	  s.amt   == qs.amt &&
	  s.add   == qs.add
	) {
          if (this.containsUtxo(s) == 0) {
	    this.wallet.utxo.push(this.wallet.utxi[c]);
          }
	  this.wallet.utxi.splice(c, 1);
	  this.spent_slips.splice(c, 1);
	  c = this.wallet.utxi.length+2;
          this.wallet.balance = this.calculateBalance();
	}
      }
    }
  }

  this.app.modules.updateBalance();
  this.app.storage.saveOptions();

}
Wallet.prototype.updateBalance = function updateBalance() {
  this.calculateBalance();
  this.app.modules.updateBalance();
}
Wallet.prototype.containsUtxi = function containsUtxi(s) {
  for (var x = 0; x < this.wallet.utxi.length; x++) {
    var y = this.wallet.utxi[x];
    if (
	s.bid == y.bid &&
	s.tid == y.tid &&
	s.sid == y.sid &&
	s.bhash == y.bhash &&
	s.amt == y.amt &&
	s.add == y.add
    ) {
      return 1;
    }
  }
  return 0;
}
Wallet.prototype.containsUtxo = function containsUtxo(s) {
  for (var x = 0; x < this.wallet.utxo.length; x++) {
    var y = this.wallet.utxo[x];
    if (
	s.bid == y.bid &&
	s.tid == y.tid &&
	s.sid == y.sid &&
	s.bhash == y.bhash &&
	s.amt == y.amt &&
	s.add == y.add
    ) {
      return 1;
    }
  }
  return 0;
}
Wallet.prototype.calculateBalance = function calculateBalance() {
  var b = 0.0;
  var minid = this.app.blockchain.returnLatestBlockId() - this.app.blockchain.returnGenesisPeriod() + 1;
  for (var x = 0; x < this.wallet.utxi.length; x++) {
    var s = this.wallet.utxi[x];
    if (s.lc == 1 && s.bid >= minid) {
      b = parseFloat(parseFloat(b) + parseFloat(s.amt)).toFixed(8);
    }
  }
  return b;
}
Wallet.prototype.handleChainReorganization = function handleChainReorganization(block_id, block_hash, lc) {
  for (var m = this.wallet.utxi.length-1; m >= 0; m--) {
    if (this.wallet.utxi[m].bhash == block_hash) { 
      this.wallet.utxi[m].lc = lc; 
    }
  }
}



Wallet.prototype.returnAddress = function returnAddress() { 
  return this.wallet.publicKey; 
}
Wallet.prototype.updateIdentifier = function updateIdentifier(id) {
  this.wallet.identifier = id;
  this.saveWallet();
}
Wallet.prototype.saveWallet = function saveWallet() {
  this.app.options.wallet = this.returnWallet();
  this.app.storage.saveOptions();
}
Wallet.prototype.returnIdentifier = function returnIdentifier() {
  return this.wallet.identifier;
}
Wallet.prototype.returnPublicKey = function returnPublicKey() {
  return this.wallet.publicKey;
}
Wallet.prototype.returnPrivateKey = function returnPublicKey() {
  return this.wallet.privateKey;
}
Wallet.prototype.returnBalance = function returnBalance() {
  this.wallet.balance = this.calculateBalance();
  return parseFloat(this.wallet.balance).toFixed(8);
}
Wallet.prototype.returnWallet = function returnWallet() {
  return this.wallet;
}
Wallet.prototype.returnWalletJson = function returnWalletJson() {
  return JSON.stringify(this.wallet);
}

