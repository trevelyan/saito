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
  this.wallet.version       = 0.80;

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



////////////////
// Initialize //
////////////////
Wallet.prototype.initialize = function initialize() {

  if (this.wallet.privateKey == "") {
    if (this.app.options.wallet != null) {

      // check to see if we have upgraded
      if (this.app.options.wallet.version != this.wallet.version) {
	if (this.app.BROWSER == 1) {
          alert("System Upgrade: we reset your browser cache");
          this.app.storage.saveOptions(1); // 1 = reset to virgin state
          this.app.archives.resetArchives();
        }
      }

      this.wallet = this.app.options.wallet;


    }
    if (this.wallet.privateKey == "") {
      this.generateKeys();
      this.app.storage.saveOptions();
    }
  }


  // purge outdated transaction outputs
  tmp_genesis_id = this.app.blockchain.returnGenesisIdBlock();
  for (m = this.wallet.utxo.length-1; m >= 0; m--) {
    if (this.wallet.utxi[m].bid < tmp_genesis_id) {
      this.wallet.utxi.splice(m, 1);
    }
  }



  if (this.app.options.wallet != null) {
    if (this.app.options.wallet.utxi != null) {
      for (i = 0; i < this.app.options.wallet.utxi.length; i++) {
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
      for (i = 0; i < this.app.options.wallet.utxo.length; i++) {
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

  // ensure slip_ids are set in proper index order
  for (mrw = 0; mrw < tx.transaction.to.length; mrw++) {
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
  value   = 0.0;


  // purge outdated transaction inputs
  tmp_genesis_id = this.app.blockchain.returnGenesisIdBlock();
  for (m = this.wallet.utxi.length-1; m >= 0; m--) {
    if (this.wallet.utxi[m].bid < tmp_genesis_id) {
      this.wallet.utxi.splice(m, 1);
    }
  }



  for (i = 0; i < this.wallet.utxi.length; i++) {
    utxiset.push(this.wallet.utxi[i]);
    value = parseFloat(this.wallet.utxi[i].amt) + parseFloat(value);
    if (value >= amount_needed) { return utxiset; }
  }

  return null;
}





///////////////////////////
// Generate Transactions //
///////////////////////////
Wallet.prototype.createUnsignedTransactionWithFee = function createUnsignedTransactionWithFee(to, amt, fee) {

  tx = new saito.transaction();



  // we could get inadequate inputs -1 if not enough money, need to deal with
  //
  // note -- inputs provided automatically as an array
  //
  // outputs are created and added manually into array
  //
  total_fees = parseFloat(amt)+parseFloat(fee);

  //
  // check that this is OK
  //
  if (total_fees > this.returnBalance()) {
    amt = 0.0;
    fee = 0.0;
    if (this.app.BROWSER == 1) {
      alert("Your wallet has no money left: sending your transaction as zero-fee, zero-payment.");
    } else {
      console.log("Your wallet has no money left: sending your transaction as zero-fee, zero-payment.");
    }
  }

  tx.transaction.from = this.getAdequateInputs(total_fees);
  tx.transaction.ts   = new Date().getTime();
  tx.transaction.to.push(new saito.slip(to, amt));


  // add our change input
  total_inputs = 0.0;
  if (tx.transaction.from != null || fee > 0) {
    for (i = 0; i < tx.transaction.from.length; i++) {
      total_inputs = parseFloat(total_inputs) + parseFloat(tx.transaction.from[i].amt);
    }
  }
  change_amount = (parseFloat(total_inputs)-parseFloat(total_fees));
  if (change_amount > 0) {
    tx.transaction.to.push(new saito.slip(this.returnPublicKey(), change_amount));
  }

  return tx;

}
Wallet.prototype.createUnsignedTransaction = function createUnsignedTransaction(to, amt) {

  tx = new saito.transaction();

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
Wallet.prototype.createGoldenTransaction = function createGoldenTransaction(winners, mysolution) {

  tx = new saito.transaction();
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
Wallet.prototype.paymentConfirmation = function paymentConfirmation(blk, tx) {

  if (tx.isTo(this.returnPublicKey())) {

    my_slips = tx.returnSlipsTo(this.returnPublicKey());

    for (ms = 0; ms < my_slips.length; ms++) {

      this_slip           = my_slips[ms];
      this_slip.bhash     = blk.hash();
      this_slip.bid       = blk.block.id;
      this_slip.tid       = tx.transaction.id;
      this_slip.sid       = my_slips[ms].sid;  //already set properly
      this_slip.lc        = 1;

      // ignore zero-value payments
      if (this_slip.amt > 0) { 
        if (this.containsUtxi(this_slip) == 0) {
	  this.wallet.utxi.push(this_slip);
	  this.wallet.balance = this.calculateBalance();
        }
      }
    }

    // save our options file to preserve records
    this.app.storage.saveOptions();

  }


  // if this is a payment FROM us and it isn't a golden ticket issuance
  // we want to remove it from our wallet. If it is a golden ticket 
  // issuance then we don't need to worry about removing any cash
  if (tx.isFrom(this.returnPublicKey()) && tx.transaction.gt == null) {
    my_slips = tx.returnSlipsFrom(this.returnPublicKey());

    for (ms = 0; ms < my_slips.length; ms++) {

      this_slip           = my_slips[ms];

      for (sc = 0; sc < this.wallet.utxi.length; sc++) {
        qs = this.wallet.utxi[sc];
        if (
			this_slip.bid   == qs.bid &&
			this_slip.tid   == qs.tid &&
			this_slip.sid   == qs.sid &&
			this_slip.bhash == qs.bhash &&
			this_slip.lc    == qs.lc &&
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

  // save our options file to preserve records
  this.app.storage.saveOptions();

}

Wallet.prototype.containsUtxi = function containsUtxi(s) {

  for (x = 0; x < this.wallet.utxi.length; x++) {
    y = this.wallet.utxi[x];
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

  for (x = 0; x < this.wallet.utxo.length; x++) {
    y = this.wallet.utxo[x];
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

  b = 0.0;

  for (x = 0; x < this.wallet.utxi.length; x++) {
    this_slip = this.wallet.utxi[x];
    if (this_slip.lc == 1) {
      b = parseFloat(parseFloat(b) + parseFloat(this_slip.amt)).toFixed(8);
    }
  }

  return b;

}
// this sets the lc variable in the matching slip to the lc variable provided (i.e. it
// lets us know whether this slip is part of the longest chain or not.
Wallet.prototype.handleChainReorganization = function handleChainReorganization(block_id, block_hash, lc) {

  for (mv = this.wallet.utxi.length-1; mv  >= 0; mv--) {
    if (this.wallet.utxi[mv].bid < block_id) { return; }
    if (this.wallet.utxi[mv].bid > block_id) { } else {
      if (this.wallet.utxi[mv].bhash == block_hash) { this.wallet.utxi[mv].lc = lc; }
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








