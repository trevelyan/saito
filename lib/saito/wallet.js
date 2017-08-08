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
  this.wallet.utxi          = [];
  this.wallet.utxo          = [];

  return this;

}
module.exports = Wallet;



////////////////
// Initialize //
////////////////
Wallet.prototype.initialize = function initialize() {

  if (this.app.options.wallet.utxi != null) {
    for (i = 0; i < this.app.options.wallet.utxi.length; i++) {
      this.wallet.utxi[i] = this.app.options.wallet.utxi[i];
    }
  }
  if (this.app.options.wallet.utxo != null) {
    for (i = 0; i < this.app.options.wallet.utxo.length; i++) {
      this.wallet.utxo[i] = this.app.options.wallet.utxo[i];
    }
  }

  if (this.wallet.privateKey == "") {
    if (this.app.options.wallet != null) {
      this.wallet = this.app.options.wallet;
    }
    if (this.wallet.privateKey == "") {
      this.generateKeys();
      this.app.storage.saveOptions();
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
  tx.transaction.msig   = this.signMessage(tx.transaction.msg);
  tx.transaction.sig    = this.signMessage(tx.paymentSignatureSource());
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

  for (i = 0; i < this.wallet.utxi.length; i++) {
    utxiset.push(this.wallet.utxi[i]);
    value = parseFloat(this.wallet.utxi[i].amt) + parseFloat(value);;
console.log("Adding up inputs: "+this.wallet.utxi[i].returnAmount() + " -- " + value + " --- " + amount_needed);
    if (value >= amount_needed) { return utxiset; }
  }

console.log("\n\n\nCOUNT NOT FIND INPUTS\n\n");
console.log(this.wallet.utxi);

  return null;
}





///////////////////////////
// Generate Transactions //
///////////////////////////
// return an empty transaction from me to me for 0.0 -- is used when padding an empty
// block, to ensure there is always one transaction available for block reward distribution
Wallet.prototype.createUnsignedTransactionWithFee = function createUnsignedTransactionWithFee(to, amt, fee) {

  tx = new saito.transaction();

  // we could get inadequate inputs -1 if not enough money, need to deal with
  //
  // note -- inputs provided automatically as an array
  //
  // outputs are created and added manually into array
  //
  total_fees = parseFloat(amt)+parseFloat(fee);
  tx.transaction.from = this.getAdequateInputs(total_fees);
  tx.transaction.ts   = new Date().getTime();
  tx.transaction.to.push(new saito.slip(to, amt));


  // add our change input
  total_inputs = 0.0;
  for (i = 0; i < tx.transaction.from.length; i++) {
    total_inputs = parseFloat(total_inputs) + parseFloat(tx.transaction.from[i].returnAmount());
  }
  change_amount = (parseFloat(total_inputs)-parseFloat(total_fees));
  tx.transaction.to.push(new saito.slip(this.returnPublicKey(), change_amount));

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
  tx.transaction.msig         = this.signMessage(tx.transaction.msg);
  tx.transaction.sig          = this.signMessage(tx.paymentSignatureSource());

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
      this_slip.bid       = blk.block.id;
      this_slip.tid       = tx.transaction.id;
      this_slip.sid       = ms+1;

      // ignore zero-value payments
      if (this_slip.returnAmount() > 0) { 
	this.wallet.balance = parseFloat(parseFloat(this.wallet.balance)+ parseFloat(this_slip.returnAmount())).toFixed(8);
	this.wallet.utxi.push(this_slip);
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
			this_slip.bid == qs.bid &&
			this_slip.tid == qs.tid &&
			this_slip.sid == qs.sid &&
			this_slip.amt == qs.amt &&
			this_slip.add == qs.add
	) {

	  // remove input
	  this.wallet.balance = parseFloat(parseFloat(this.wallet.balance) - parseFloat(this_slip.returnAmount())).toFixed(8);
	  this.wallet.utxo.push(this.wallet.utxi[sc]);
	  this.wallet.utxi.splice(sc, 1);
	  sc = this.wallet.utxi.length+2;
	}
      }
    }
  }

  // update 
  this.app.browser.updateBalance();

  // save our options file to preserve records
  this.app.storage.saveOptions();

}













Wallet.prototype.returnAddress = function returnAddress() {
  return this.wallet.publicKey;
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




