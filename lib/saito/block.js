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
  this.block.treasury         = 21000000.0;  // the amount that still needs to be released
  this.block.coinbase         = 100;         // the amount for this block -- will be adjusted at first ticket



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
  this.confirmations                 = -1;     // number of confirmations
  this.callbacks                     = [];    // when attached
  this.callbacksTx                   = [];    // relevant index in tx array


  //////////////////////
  // create from JSON //
  //////////////////////
  if (blkjson != "") {
    this.block = JSON.parse(blkjson);
    for (nv = 0; nv < this.block.transactions.length; nv++) {
      this.transactions[nv] = new saito.transaction(this.block.transactions[nv]);
    }
  }

  return this;

}
module.exports = Block;













Block.prototype.hash = function hash(enc) {
  return this.app.crypt.hash( this.returnBlockHashSource() );
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
Block.prototype.returnBlockHashSource = function returnBlockHashSource() {

  blocksigsrc 	= this.block.unixtime
		+ this.block.prevhash
		+ this.block.roothash
		+ this.block.miner
		+ this.block.id
		+ this.block.burn_fee
		+ this.block.fee_step
		+ this.block.difficulty
		+ this.block.paysplit
		+ this.block.treasury
		+ this.block.coinbase;

  return blocksigsrc;

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


  // validate merkleTree root
  if (this.block.transactions.length > 0) {
    tmproot = this.app.crypt.merkleTree(this.block.transactions).root;
    if (tmproot != this.block.roothash) {
      console.log("Block transaction roothash is not as expected");
      return 0;
    }
  }


  // calculate if fees are adequate
  //
  // lite nodes skip this since we dont
  // have transaction-level data
  //
  var transaction_fees_needed = this.calculateTransactionFeesNeeded(this.block.prevhash);
  var transaction_fees_paid   = 0;
  if (this.block.transactions.length > 0) {
    for (i = 0; i < this.block.transactions.length; i++) {
      transaction_fees_paid += this.transactions[i].returnFee();
    }
    if (transaction_fees_needed > transaction_fees_paid) {
      console.log("Block invalid: not enough fees paid");
      return 0;
    }
  }

  // confirm that each transaction verifies
  for (zz = 0; zz < this.transactions.length; zz++) {
    if (this.transactions[zz].validate(this.app) != 1) {
      console.log("Block invalid: contains invalid transaction");
      console.log(this.transactions[zz].transaction);
      return 0;
    }
  }

  // check if paysplit and difficulty vote are correct
  // check if monetary policy is correct
  if (this.validateGoldenTicket() == 0) {
    console.log("Block invalid: contains invalid golden ticket");
    this.app.blockchain.mempool.removeGoldenTicket();
    return 0;
  }


  // if we reach here, the block is OK
  return 1;

}


Block.prototype.createBlock = function createBlock(prevblock=null) {

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
  if (this.transactions.length == 0) {
    this.block.roothash = "";
  }
  else {
    this.block.roothash   = this.app.crypt.merkleTree(this.block.transactions).root;
  }
  this.block.miner      = this.app.wallet.returnPublicKey();



  // set values from previous block
  if (prevblock != null) {
    this.block.coinbase   = prevblock.block.coinbase;  // not adjusted unless golden ticket found below
    this.block.treasury   = prevblock.block.treasury;  // not adjusted unless golden ticket found below
    this.block.prevhash   = prevblock.hash();
    this.block.difficulty = prevblock.returnDifficulty();
    this.block.paysplit   = prevblock.returnPaysplit();
  } else {
    this.block.prevhash   = "";
    this.block.paysplit   = 0.5;
    this.block.difficulty = 1;
  }


  ///////////////////////////////
  // set our vote for paysplit //
  ///////////////////////////////
  this.block.paysplit_vote   = this.app.blockchain.voter.returnPaysplitVote(this.block.paysplit);







  ///////////////////////////////
  // adjust consensus settings //
  ///////////////////////////////
  //
  // this also adjusts our coinbase
  // and our treasury settings
  this.handleGoldenTicket();




  // add to blockchain and propagate
  this.app.blockchain.addBlock(this);

}








////////////////////////////////
// Transaction Fee Management //
////////////////////////////////
Block.prototype.calculateTransactionFeesNeeded = function calculateTransactionFeesNeeded(prevblockhash) {

  var unixtime_original        = this.app.blockchain.returnUnixtime(prevblockhash);
  var unixtime_current         = this.block.unixtime;
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
      children.push(this.transactions[v].transaction.to[x].returnAddress());
    }
  }

  return children;
}
Block.prototype.handleGoldenTicket = function handleGoldenTicket() {

  // check to see if we have a golden ticket in this block
  for (i = 0; i < this.transactions.length; i++) {
    if (this.transactions[i].transaction.gt != null) {

      x = this.transactions[i].transaction.gt;

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


      // because we have a golden ticket, we adjust treasury (amount yet to be released)
      //
      // 1. burn fee deducted from treasury
      //
      this.block.treasury = this.block.treasury - x.miner_share - x.node_share;
      this.block.treasury = this.block.treasury.toFixed(8);


      //
      // 2. recalculate coinbase (new coinage added to each golden ticket)
      //
      // coinbase is the total amount in our treasury divided by the period 
      this.block.coinbase = (this.block.treasury / this.app.blockchain.genesis_period).toFixed(8);

      //
      // note that adjustments to the coinbase require tickets to be solved
      // as well. this means that a single adjustment can push up the
      // amount of coinbase significantly, but means attackers will need
      // to lock significant sums away in the treasury unless they are able
      // to reduce the difficulty... which takes time and actual hash power
      //


      // we only process one golden ticket by default
      i = this.transactions.length + 10;

    }
  }
}
Block.prototype.validateGoldenTicket = function validateGoldenTicket() {

  prevblk = this.app.blockchain.returnBlockByHash(this.block.prevhash);

  // lite clients cannot always validate Golden Tickets because they 
  // do not always have access to the previous block. This can happen
  // with orphaned clients or missing blocks. 
  //
  // so we check and if we don't have the previous block, we skip 
  // validating the golden ticket. 
  if (prevblk == null) {
    //console.log("Previous Block is NULL -- light clients need to be able to validate blocks without checking GT information");
    return 1;
  }

  // calculate our payment, and the two paysplit amounts given our timestamp
  // our payment is the total amount of fees paid, minus the paysplit amount
  // which gets distributed to the rest of the transaction network
  //
  // copied right out of miner class -- refactoring needed
  var txfees_total  = parseFloat(0.0 + prevblk.calculateTransactionFees()).toFixed(8);
  var txfees_needed = parseFloat(0.0 + prevblk.calculateTransactionFeesNeeded(prevblk.block.prevhash)).toFixed(8);
  var total_revenue = parseFloat(txfees_needed) + parseFloat(prevblk.block.coinbase);
  var miner_share   = parseFloat(total_revenue * prevblk.block.paysplit).toFixed(8);
  var node_share    = (total_revenue - miner_share).toFixed(8);
  if (node_share < 0)             { node_share = 0; }

  current_paysplit   = this.returnPaysplit();
  current_difficulty = this.returnDifficulty();
  last_paysplit      = prevblk.returnPaysplit();
  last_difficulty    = prevblk.returnDifficulty();



  // check to see if we have a golden ticket in this block
  for (i = 0; i < this.transactions.length; i++) {
    if (this.transactions[i].transaction.gt != null) {

      // validate golden ticket signature
      x = this.transactions[i].transaction.gt;
      solmsg = x.target+x.difficulty_vote+x.paysplit_vote+x.miner_share+x.node_share;
      v = this.app.crypt.verifyMessage(solmsg, x.signature, x.pubkey);
      if (v == false) {
        console.log("Golden Ticket does not validate!");
        return 0;
      }

 
      // validate miner and node shares
      //
      // we cannot validate this if the previous block of our previous block 
      // is null, as in that case we cant figure out what the appropriate 
      // transaction fees are going to be. So we have to take this on faith
      // as a consequence of having a disposible blockchain and then
      // handle it from there.
      //
      // think about ways to improve this, for instance with downloading the
      // headers of the first blocks as part of the sync process and then 
      // checking against multiple other clients.
      // 
      if (prevblk.block.prevhash == "" || prevblk.block.prevhash == null) {
        if (miner_share != x.miner_share) {
          console.log("Miner Share does not equal what it should: "+miner_share + " -- " + x.miner_share);
console.log(JSON.stringify(x));
          return 0;
        }
        if (node_share != x.node_share) {
          console.log("Node Share does not equal what it should: "+node_share + " -- " + x.node_share);
          return 0;
        }
      }



      // validate two votes
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


      // validate monetary policy
      prev_treasury = prevblk.block.treasury;
      prev_coinbase = prevblk.block.coinbase;

      // because we have a golden ticket, we adjust treasury (amount yet to be released)
      //
      // 1. burn fee deducted from treasury
      //
      prev_treasury = prev_treasury - x.miner_share - x.node_share;
      prev_treasury = prev_treasury.toFixed(8);

      //
      // 2. recalculate coinbase (new coinage added to each golden ticket)
      //
      // coinbase is the total amount in our treasury divided by the period
      prev_coinbase = (prev_treasury / this.app.blockchain.genesis_period).toFixed(8);

      //
      // note that adjustments require the coinbase to be solved as well
      //
      // this ensures we are solving golden tickets (miner & node support)
      // in order to start printing more money. purging old transactions
      // increases the treasury, but does not immediately affect the coinbase
      //
      if (prev_treasury != this.block.treasury) { 
        console.log("Treasury invalid: "+this.block.treasury+ " -- " + prev_treasury + " -- " + prevblk.block.treasury);
console.log("MINER STUFF: " + x.miner_share + " --- " + x.node_share);
console.log(txfees_total + " -- " + txfees_needed + " -- " + total_revenue + " -- " + miner_share + " -- " + node_share + " -- " + last_paysplit + " -- " + last_difficulty);
        return 0;
      }
      if (prev_coinbase != this.block.coinbase) { 
        console.log("Coinbase invalid: "+this.block.coinbase+ " -- " + prev_coinbase);
        return 0;
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
Block.prototype.runCallbacks = function runCallbacks(confnum) {
  for (cc = this.confirmations+1; cc <= confnum; cc++) {
    for (ztc = 0; ztc < this.callbacks.length; ztc++) {
console.log('PROCESSING CALLBACKS 1 at index: '+ztc+ ' -- ' + confnum);
      this.callbacks[ztc](this.transactions[this.callbacksTx[ztc]], cc, this.app);
console.log('PROCESSING CALLBACKS 2 at index: '+ztc+ ' -- ' + confnum);
    }
  }
  this.confirmations = confnum;
}













Block.prototype.addTransaction = function addTransaction(tx) {
  this.block.transactions.push(JSON.stringify(tx));
  this.transactions.push(tx);
}
Block.prototype.importTransaction = function importTransaction(txjson) {
  tx = new saito.transaction(txjson);
  this.addTransaction(tx);
}





