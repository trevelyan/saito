var saito = require('../saito');


function Wallet(app, walletjson="") {

  if (!(this instanceof Wallet)) {
    return new Wallet(app, walletjson);
  }

  this.app     = app || {};


  ////////////////////////////
  // serialized for storage //
  ////////////////////////////
  this.wallet               = {};
  this.wallet.balance       = parseFloat(0.0);
  this.wallet.privateKey    = "";
  this.wallet.publicKey     = "";
  this.wallet.identifier    = "";
  this.wallet.utxi          = [];
  this.wallet.utxo          = [];
  this.wallet.version       = 1.12;

  return this;

}
module.exports = Wallet;


Wallet.prototype.resetWallet = function resetWallet() {
  this.wallet.privateKey = "";
  this.wallet.publicKey  = "";
  this.wallet.identifier = "";
  this.wallet.balance    = parseFloat(0.0);
  this.wallet.utxi       = [];
  this.wallet.utxo       = [];
}


//
// reset the "spent" inputs to zero if they are still in our
// wallet. the "spent" variable is just used to avoid sending
// multiple transactions in each block with the same input.
Wallet.prototype.resetSpentInputs = function resetSpentInputs() {
  for (var wi = 0; wi < this.wallet.utxi.length; wi++) { this.wallet.utxi[wi].spent = 0; }
}


////////////////
// Initialize //
////////////////
Wallet.prototype.initialize = function initialize() {

  if (this.wallet.privateKey == "") {
    if (this.app.options.wallet != null) {

      // check to see if we have upgraded
      if (this.app.options.wallet.version != this.wallet.version) {
	if (this.app.BROWSER == 1) {

          this.app.options.wallet.version = this.wallet.version;

          var tmp_privatekey = this.app.options.wallet.privateKey;
          var tmp_publickey  = this.app.options.wallet.publicKey;
          var tmp_identifier = this.app.options.wallet.identifier;

          alert("System Upgrade: we reset your browser cache");

          this.app.storage.saveOptions(1); // 1 = reset to virgin state
          this.app.archives.resetArchives();

          this.wallet.publicKey  = tmp_publickey;
          this.wallet.privateKey = tmp_privatekey;
          this.wallet.identifier = tmp_identifier;

	  // uncomment this if we want to reset the blockchain
  	  this.app.options.blockchain.lastblock = "";
	  this.app.storage.saveOptions();

          this.saveWallet();

        }
      }

      this.wallet = this.app.options.wallet;

    }
    if (this.wallet.privateKey == "") {
      this.generateKeys();
      this.app.storage.saveOptions();
    }
  }




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
		this.app.options.wallet.utxi[i].lc
	);
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
		this.app.options.wallet.utxo[i].lc
	);
      }
    }
  }


  // purge outdated transaction outputs
  var tmp_genesis_id = this.app.blockchain.returnGenesisBlockId();
  for (var m = this.wallet.utxo.length-1; m >= 0; m--) {
    if (this.wallet.utxo[m].bid < tmp_genesis_id) {
      this.wallet.utxo.splice(m, 1);
    }
  }

}








//////////////////////
// Crypto Functions //
//////////////////////
Wallet.prototype.generateKeys = function generateKeys() {
  var hasher = new saito.crypt();
  this.wallet.privateKey = hasher.generateKeys();
  this.wallet.publicKey  = hasher.returnPublicKey(this.wallet.privateKey);
  this.app.storage.saveOptions();
}
Wallet.prototype.signTransaction = function signTransaction(tx) {

  if (tx == null) { return null; }

  // ensure slip_ids are set in proper index order
  for (var mrw = 0; mrw < tx.transaction.to.length; mrw++) {
    tx.transaction.to[mrw].sid = mrw;
  }

  tx.transaction.msig   = this.signMessage(tx.transaction.msg);
  tx.transaction.sig    = this.signMessage(tx.signatureSource());
  return tx;
}

// takes JSON
Wallet.prototype.signMessage = function signMessage(message) {
  return saito.crypt().signMessage(message, this.wallet.privateKey);
}

// takes JSON
Wallet.prototype.verifyMessage = function verifyMessage(message, sig, publicKey) {
  return saito.crypt().verifyMessage(message, sig, publicKey);
}






///////////////////////////////////////////
// Payslip (Input and Output) Management //
///////////////////////////////////////////
Wallet.prototype.addInput = function addInput(x) {
  this.wallet.utxi.push(x);
}
Wallet.prototype.getAdequateInputs = function getAdequateInputs(amount_needed) {

  var utxiset = [];
  var value   = 0.0;

  var lowest_block_acceptable = this.app.blockchain.returnLatestBlockId() - this.app.blockchain.returnGenesisPeriod();
      lowest_block_acceptable = lowest_block_acceptable+1;

console.log("in wallet making tx: lowest acceptable block is: "+lowest_block_acceptable);
console.log("OUR LATEST BLOCK: "+this.app.blockchain.returnLatestBlockId());


  // purge outdated transaction inputs
  var tmp_genesis_id = this.app.blockchain.returnGenesisBlockId();
  for (var m = this.wallet.utxi.length-1; m >= 0; m--) {
    if (this.wallet.utxi[m].bid < tmp_genesis_id) {
      this.wallet.utxi.splice(m, 1);
    }
  }

  for (var i = 0; i < this.wallet.utxi.length; i++) {
    if (this.wallet.utxi[i].lc == 1 && this.wallet.utxi[i].bid >= lowest_block_acceptable) {

      // we market inputs gathered here as spent (so we do not double-spend)
      if (this.wallet.utxi[i].spent == 0) {
        this.wallet.utxi[i].spent = 1;
        utxiset.push(this.wallet.utxi[i]);
        value = parseFloat(this.wallet.utxi[i].amt) + parseFloat(value);
        if (value >= amount_needed) { return utxiset; }
      }
    }
  }

  return null;
}





///////////////////////////
// Generate Transactions //
///////////////////////////
Wallet.prototype.createUnsignedTransactionWithFee = function createUnsignedTransactionWithFee(to, amt, fee) {

  var tx = new saito.transaction();


  // we could get inadequate inputs -1 if not enough money, need to deal with
  //
  // note -- inputs provided automatically as an array
  //
  // outputs are created and added manually into array
  //
  var total_fees = parseFloat(amt)+parseFloat(fee);

  //
  // check that this is OK
  //
  if (total_fees > this.returnBalance()) {
    var amt = 0.0;
    var fee = 0.0;

    if (this.app.BROWSER == 1) {
      alert("Your wallet has no money left: sending your transaction as zero-fee, zero-payment.");
    } else {
      console.log("Your wallet has no money left: sending your transaction as zero-fee, zero-payment.");
    }
  }

  tx.transaction.from = this.getAdequateInputs(total_fees);
  tx.transaction.ts   = new Date().getTime();
  tx.transaction.to.push(new saito.slip(to, amt));

  if (tx.transaction.from == null) { return null; }

  // add our change input
  var total_inputs = 0.0;
  if (tx.transaction.from != null || fee > 0) {
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
Wallet.prototype.createUnsignedTransaction = function createUnsignedTransaction(to, amt) {

  var tx = new saito.transaction();

  // we could get inadequate inputs -1 if not enough money, need to deal with
  //
  // note -- inputs provided automatically as an array
  //
  // outputs are created and added manually into array
  //
  tx.transaction.from = this.getAdequateInputs(amt);
  tx.transaction.ts   = new Date().getTime();
  tx.transaction.to.push(new saito.slip(to, amt));

  return tx;

}

// this creates a transaction to capture fees when creating blocks
//
// i.e. we create the block, we can create a single tx with 
// outputs we can reference in the future to spend our fees.
Wallet.prototype.createFeeTransaction = function createFeeTransaction(my_fee) {

  var tx = new saito.transaction();

  from_slip = new saito.slip(this.returnPublicKey(), 0.0, 0);
  from_slip.ft = 1;
  tx.transaction.from.push(from_slip);

  to_slip = new saito.slip(this.returnPublicKey(), my_fee, 0);
  tx.transaction.to.push(to_slip);

  tx.transaction.ts           = new Date().getTime();
  tx.transaction.msg          = "fee capture";
  tx.transaction.ft           = 1;

  tx = this.signTransaction(tx);

  return tx;

}

Wallet.prototype.createGoldenTransaction = function createGoldenTransaction(winners, mysolution) {

  var tx = new saito.transaction();
  tx.transaction.from.push(new saito.slip(this.returnPublicKey(), 0.0, 1));

  tx.transaction.to.push(winners[0]);
  tx.transaction.to.push(winners[1]);
  tx.transaction.ts           = new Date().getTime();
  tx.transaction.gt           = mysolution;
  tx.transaction.msg          = "golden ticket";

  tx = this.signTransaction(tx);

  return tx;

}




/////////////////////////
// Keep Track of Money //
/////////////////////////
//
// this function is called when payments arrive in blocks
// after we validate them but before we include them in
// the blockchain.
//
// this is where we add slips to our wallet and where
// we remove ones that have been spent.
//
Wallet.prototype.paymentConfirmation = function paymentConfirmation(blk, tx, i_am_the_longest_chain) {

  if (tx.isTo(this.returnPublicKey())) {

    var my_slips = tx.returnSlipsTo(this.returnPublicKey());

    for (var ms = 0; ms < my_slips.length; ms++) {

      var this_slip           = my_slips[ms];
      this_slip.bhash     = blk.hash();
      this_slip.bid       = blk.block.id;
      this_slip.tid       = tx.transaction.id;
      this_slip.sid       = my_slips[ms].sid;  //already set properly
      this_slip.lc        = i_am_the_longest_chain;

      // ignore zero-value payments
      if (this_slip.amt > 0) { 
        if (this.containsUtxi(this_slip) == 0) {
	
	  // make sure this is not already spent
	  // in which case we will have a utxo
	  // record for the slip.
	  //
	  // otherwise on reload we can input a 
	  // new slip that will be unspendable 
	  // as is already spent, but seems fresh
	  // to us as is our first new block
	  if (this.containsUtxo(this_slip) == 0) {
	    this.wallet.utxi.push(this_slip);
	    this.wallet.balance = this.calculateBalance();
	  }
        }
      }
    }

    this.app.storage.saveOptions();

  }


  // if this is a payment FROM us and it isn't a golden ticket issuance
  // we want to remove it from our wallet. If it is a golden ticket 
  // issuance then we don't need to worry about removing any cash
  if (tx.isFrom(this.returnPublicKey()) && tx.transaction.gt == null) {
    var my_slips = tx.returnSlipsFrom(this.returnPublicKey());

    for (var ms = 0; ms < my_slips.length; ms++) {

      var this_slip           = my_slips[ms];

      for (var sc = 0; sc < this.wallet.utxi.length; sc++) {
        var qs = this.wallet.utxi[sc];
        if (
			this_slip.bid   == qs.bid &&
			this_slip.tid   == qs.tid &&
			this_slip.sid   == qs.sid &&
			this_slip.bhash == qs.bhash &&
			this_slip.amt   == qs.amt &&
			this_slip.add   == qs.add
	) {

	  // remove input
          if (this.containsUtxo(this_slip) == 0) {
	    this.wallet.utxo.push(this.wallet.utxi[sc]);
          }
	  this.wallet.utxi.splice(sc, 1);
	  sc = this.wallet.utxi.length+2;
          this.wallet.balance = this.calculateBalance();
	}
      }
    }
  }

  // update 
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
  var minimum_block_id = this.app.blockchain.returnLatestBlockId() - this.app.blockchain.returnGenesisPeriod() + 1;

  for (var x = 0; x < this.wallet.utxi.length; x++) {
    var this_slip = this.wallet.utxi[x];
    if (this_slip.lc == 1 && this_slip.bid >= minimum_block_id) {
      b = parseFloat(parseFloat(b) + parseFloat(this_slip.amt)).toFixed(8);
    }
  }

  return b;

}
// this sets the lc variable in the matching slip to the lc variable provided (i.e. it
// lets us know whether this slip is part of the longest chain or not.
Wallet.prototype.handleChainReorganization = function handleChainReorganization(block_id, block_hash, lc) {

if (this.app.BROWSER == 1) {
  console.log("HANDLE CHAIN REORGANIZATION: "+this.wallet.utxi.length);
}
  for (var mv = this.wallet.utxi.length-1; mv >= 0; mv--) {
    if (this.wallet.utxi[mv].bhash == block_hash) { 
if (this.app.BROWSER == 1) {
  console.log("UPDATING WALLET SLIP: " + mv + " -- " + this.wallet.utxi[mv].bhash);
  console.log(this.wallet.utxi);
}
      this.wallet.utxi[mv].lc = lc; 
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
  this.calculateBalance();
  return parseFloat(this.wallet.balance).toFixed(8);
}
Wallet.prototype.returnWallet = function returnWallet() {
  return this.wallet;
}
Wallet.prototype.returnWalletJson = function returnWalletJson() {
  return JSON.stringify(this.wallet);
}
Wallet.prototype.returnEmptyTransaction = function returnEmptyTransaction() {
  return this.signTransaction(this.createUnsignedTransaction(this.returnAddress(), 0.0));
}








