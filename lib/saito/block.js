var saito = require('../saito');


function Block(app, blkjson="") {

  if (!(this instanceof Block)) {
    return new Block(app, blkjson);
  }

  this.app = app || {};

  ////////////////////////
  // included in blocks //
  ////////////////////////
  this.block                  = {};
  this.block.unixtime         = new Date().getTime();
  this.block.prevhash         = "";                   // hash of previous block
  this.block.roothash         = "";                   // hash of merkle tree
  this.block.miner            = "";
  this.block.id               = 1;
  this.block.transactions     = [];    // array of transactions as json


  /////////////////////////
  // consensus variables //
  /////////////////////////
  this.block.burn_fee         = 2.0;   // this should be set to network consensus levels
  this.block.fee_step         = 0.000165; 


  this.block.difficulty       = 1.0;   // this should be set to network consensus levels
  this.block.paysplit         = 0.5;   // this should be set to network consensus levels
  this.block.coinbase         = 0;


  ////////////
  // voting //
  ////////////
  this.block.paysplit_vote    = 0;     // -1 reduce miner payout
                                       //  0 no change
                                       //  1 increase miner payout


  ////////////////////////////
  // not included in blocks //
  ////////////////////////////
  this.transactions                  = [];    // array of transaction objects
  this.confirmations                 = 0;     // number of confirmations
  this.callbacks                     = [];    // when attached
  this.callbacksTx                   = [];    // relevant index in tx array


  //////////////////////
  // create from JSON //
  //////////////////////
  if (blkjson != "") {
    this.block = JSON.parse(blkjson);
    for (i = 0; i < this.block.transactions.length; i++) {
      this.transactions[i] = new saito.transaction(this.block.transactions[i]);
    }
  }


  return this;

}
module.exports = Block;













Block.prototype.hash = function hash(enc) {
  return this.app.crypt.hash( JSON.stringify( this.block ) );
}
Block.prototype.returnId = function returnId() {
  return this.block.id;
}
Block.prototype.returnDifficulty = function returnDifficulty() {
  return this.block.difficulty;
}
Block.prototype.returnPaysplit = function returnPaysplit() {
  return this.block.paysplit;
}
Block.prototype.returnPaysplitVote = function returnPaysplitVote() {
  return this.block.paysplit_vote;
}
Block.prototype.returnJson = function returnJson() {
  return JSON.stringify(this.returnBlock());
}
Block.prototype.returnBlock = function returnBlock() {
  return this.block;
}
Block.prototype.returnBurnFee = function returnBurnFee() {
  return this.block.burn_fee;
}
Block.prototype.returnFeeStep = function returnFeeStep() {
  return this.block.fee_step;
}
Block.prototype.returnMaxTxId = function returnMaxTxId() {
  mti = 0;
  for (z = 0; z < this.transactions.length; z++) {
    if (this.transactions[z].transaction.id > mti) {
      mti = this.transactions[z].transaction.id;
    }
  }
  return mti;
}







////////////////////////////////////
// Creating and Validating Blocks //
////////////////////////////////////
Block.prototype.validate = function validate() {

  // get the time of the previous block
  var lastblock_unixtime = this.app.blockchain.returnUnixtime(this.block.prevhash);
  if (lastblock_unixtime == "" && this.block.prevhash != "") {
    console.log("Block does not validate as previous block not in index");
    return 0;
  }


  if (this.block.transactions.length != this.transactions.length) {
    console.log("Block transactions do not match. Discarding.");
    return 0;
  }

  // calculate if fees are adequate
  var transaction_fees_needed = this.calculateTransactionFeesNeeded(this.block.prevhash);
  var transaction_fees_paid   = 0;
  for (i = 0; i < this.block.transactions.length; i++) {
    transaction_fees_paid += this.transactions[i].returnFee();
  }
  if (transaction_fees_needed > transaction_fees_paid) {
    console.log("Block invalid: not enough fees paid");
    return 0;
  }


  // confirm that each transaction verifies
  for (zz = 0; zz < this.transactions.length; zz++) {
    if (this.transactions[zz].validate(this.app) != 1) {
      console.log("Block invalid: contains invalid transaction");
      return 0;
    }
  }

  // check if paysplit and difficulty vote are adequate
  if (this.validateGoldenTicket() == 0) {
    console.log("Block invalid: contains invalid golden ticket");
    this.app.blockchain.mempool.removeGoldenTicket();
    return 0;
  }

  // if we reach here, the block is OK
  return 1;

}


Block.prototype.createBlock = function createBlock(prevblock=null) {

  // if there are no transactions, create a blank one just so
  // we can create a block
  if (this.block.transactions.length == 0) {
    this.addTransaction(this.app.wallet.returnEmptyTransaction());
  }


  // make sure transactions are alphabetized. this avoids
  // transaction malleability. non-alphabetized blocks are
  // invalid
  this.transactions.sort();


  // add sequential transaction IDs
  var mtid = 0;
  if (prevblock != null) { mtid = prevblock.returnMaxTxId(); }
  for (i = 0; i < this.transactions.length; i++) {
    mtid++;
    this.transactions[i].transaction.id = mtid;
  }


  // update transaction information in block
  for (i = 0; i < this.transactions.length; i++) {
    this.block.transactions[i] = this.transactions[i].returnTransactionJson();
  }



  // add sequential block IDs
  // in the chain we are trying to create
  if (prevblock == null) {
    this.block.id = 1;
  } else {
    this.block.id = prevblock.block.id+1;
  }



  // update ancilliary hash fields
  this.block.roothash   = this.app.crypt.merkleTree(this.transactions).root;
  this.block.miner      = this.app.wallet.returnPublicKey();



  // set values from previous block
  if (prevblock != null) {
    this.block.prevhash   = prevblock.hash();
    this.block.difficulty = prevblock.returnDifficulty();
    this.block.paysplit   = prevblock.returnPaysplit();
  } else {
    this.block.prevhash   = "";
    this.block.paysplit   = 0.5;
    this.block.difficulty = 1;
  }


  // set our vote for paysplit
  this.block.paysplit_vote   = -1;  // decrease payout to miners



  // calculate our payment, and the two paysplit amounts given our timestamp
  // our payment is the total amount of fees paid, minus the paysplit amount
  // which gets distributed to the rest of the transaction network
  var txfees_total  = parseFloat(0.0 + this.calculateTransactionFees());
  var txfees_needed = parseFloat(0.0 + this.calculateTransactionFeesNeeded(this.block.prevhash));
  var miner_share   = parseFloat(txfees_needed * this.block.paysplit);
  var node_share    = txfees_needed - miner_share;
  var my_share      = txfees_total - miner_share - node_share;




  ///////////////////////////////
  // adjust consensus settings //
  ///////////////////////////////
  this.handleGoldenTicket();


  // add to blockchain and propagate
  this.app.blockchain.addBlock(this);

}








////////////////////////////////
// Transaction Fee Management //
////////////////////////////////
Block.prototype.calculateTransactionFeesNeeded = function calculateTransactionFeesNeeded(prevblockhash) {

  var unixtime_original        = this.app.blockchain.returnUnixtime(prevblockhash);
  var unixtime_current         = new Date().getTime();
  var milliseconds_since_block = unixtime_current - unixtime_original;
  var feesneeded = ( this.returnBurnFee() - (this.returnFeeStep() * milliseconds_since_block) );
  if (feesneeded < 0) { feesneeded = 0; }

  return feesneeded.toFixed(8);

}

Block.prototype.calculateTransactionFees = function calculateTransactionFees() {

  var total_fees = 0;

  for (zz = 0; zz < this.transactions.length; zz++) {
    total_fees += this.transactions[zz].returnFee();
  }

  return total_fees.toFixed(8);

}









//////////////////////////////
// Golden Ticket Management //
//////////////////////////////
// currently we are just picking someone who originated the transaction. this needed
// to be changed so that it picks someone who is on the path of data-provision and
// message-passing, something that arguably should include the person sending the
// transaction
Block.prototype.returnGoldenTicketContenders = function returnGoldenTicketContenders() {

  var children = [];

  for (v = 0; v < this.transactions.length; v++) {
    for (x = 0; x < this.transactions[v].transaction.to.length; x++) {
      children.push(this.transactions[v].transaction.to[x].address);
    }
  }

  return children;
}
Block.prototype.handleGoldenTicket = function handleGoldenTicket() {

  // check to see if we have a golden ticket in this block
  for (i = 0; i < this.transactions.length; i++) {
    if (this.transactions[i].transaction.gt != null) {

      // our two votes
      diffvote = this.transactions[i].transaction.gt.difficulty_vote;
      paysvote = this.transactions[i].transaction.gt.paysplit_vote;

      if (paysvote == -1) {
        this.block.paysplit -= 0.0001;
        this.block.paysplit = this.block.paysplit.toFixed(8);
      }
      if (paysvote == 1) {
        this.block.paysplit += 0.0001;
        this.block.paysplit = this.block.paysplit.toFixed(8);
      }
      if (diffvote == -1) {
        this.block.difficulty -= 0.0001;
        this.block.difficulty = this.block.difficulty.toFixed(8);
      }
      if (diffvote == 1) {
        this.block.difficulty += 0.0001;
        this.block.difficulty = this.block.difficulty.toFixed(8);
      }

    }
  }
}
Block.prototype.validateGoldenTicket = function validateGoldenTicket() {

  prevblk = this.app.blockchain.returnBlockByHash(this.block.prevhash);

  console.log("validating: "+this.hash());
  console.log("prevblk  : "+prevblk.hash());
  console.log("thisblkph: "+this.block.prevhash);

  if (prevblk == null) {
    console.log("Previous Block is NULL");
    return 1;
  }

  current_paysplit   = this.returnPaysplit();
  current_difficulty = this.returnDifficulty();
  last_paysplit      = prevblk.returnPaysplit();
  last_difficulty    = prevblk.returnDifficulty();

  console.log(current_paysplit + " --- " + current_difficulty + " --- " + last_paysplit + " --- " + last_difficulty);


  // check to see if we have a golden ticket in this block
  for (i = 0; i < this.transactions.length; i++) {
    if (this.transactions[i].transaction.gt != null) {

      // we only reach this if we have a golden ticket, in which case
      // we need to validate that it is correct and that the block
      // appropriately adjusted its settings
      x = this.transactions[i].transaction.gt;
      hashToVerify = this.app.crypt.hash(x.target+x.difficulty_vote+x.paysplit_vote);
      v = this.app.crypt.verifyMessage((x.target+x.difficulty_vote+x.paysplit_vote), x.signature, x.pubkey);
      if (v == false) {
        console.log("Golden Ticket does not validate!");
        return 0;
      }


      // our two votes
      diffvote = x.difficulty_vote;
      paysvote = x.paysplit_vote;

      if (paysvote == -1) {
        if (current_paysplit != (last_paysplit - 0.0001).toFixed(8)) {
console.log(current_paysplit + " -- " + last_paysplit + " --- " + paysvote);
console.log("paysplit is wrong...1");
          return 0;
        }
      }
      if (paysvote == 1) {
        if (current_paysplit != (last_paysplit + 0.0001).toFixed(8)) {
console.log(currnt_paysplit + " -- " + last_paysplit + " --- " + paysvote);
console.log("paysplit is wrong...2");
          return 0;
        }
      }
      if (diffvote == -1) {
        if (current_paysplit != (last_difficulty - 0.0001).toFixed(8)) {
console.log("paysplit is wrong...3");
          return 0;
        }
      }
      if (diffvote == 1) {
        if (current_paysplit != (last_difficulty + 0.0001).toFixed(8)) {
console.log("paysplit is wrong...4" );
          return 0;
        }
      }

      return 1;
    }
  }

  // if we reach here, we have not found a golden ticket, in which case
  // the values of our paysplit should be the same as in the previous
  // blocka
  if (current_paysplit != last_paysplit) { return 0; }
  if (last_difficulty  != current_difficulty) { return 0; }

}








/////////////////////////////////////
// Callback Management for Modules //
/////////////////////////////////////
//
// add the module callbacks directly to our blocks so that
// we can iterate down a blockchain and just call them
// directly.
//
Block.prototype.affixCallbacks = function affixCallbacks() {
  for (z = 0; z < this.transactions.length; z++) {
    this.app.modules.affixCallbacks(z, this.transactions[z].transaction.msg, this.callbacks, this.callbacksTx, this.app);
  }
}
// we don't process confirmations on orphaned blocks when they come in
// instead we have a confirmation variable associated with blocks that
// tells us how many confirmations have been processed. This means that
// sometimes this.confirmations will fall back of confnum and we will
// process them all in a run at the same time once the block has been
// identified as part of the longest chain.
Block.prototype.runCallbacks = function runCallbacks(confnum) {
  for (cc = this.confirmations+1; cc <= confnum; cc++) {
    for (z = 0; z < this.callbacks.length; z++) {
      this.callbacks[z](this.transactions[this.callbacksTx[z]], cc, this.app);
    }
  }
  this.confirmations = confnum;
}













Block.prototype.addTransaction = function addTransaction(tx) {
  this.block.transactions.push(JSON.stringify(tx));
  this.transactions.push(tx);

}
Block.prototype.importTransaction = function importTransaction(txjson) {
  this.block.transactions.push(txjson);
  this.transactions.push(new saito.transaction(txjson));
}





