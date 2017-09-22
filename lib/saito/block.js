var saito = require('../saito');


function Block(app, blkjson="", conf=-1) {

  if (!(this instanceof Block)) {
    return new Block(app, blkjson, conf=-1);
  }

  this.app = app || {};

  ////////////////////////
  // included in blocks //
  ////////////////////////
  this.block                  = {};
  this.block.unixtime         = new Date().getTime();
  this.block.prevhash         = "";    
  this.block.roothash         = "";                   	// hash of merkle tree
  this.block.miner            = "";
  this.block.id               = 1;
  this.block.transactions     = [];    			// array of transactions as json


  /////////////////////////
  // consensus variables //
  /////////////////////////
  this.block.burn_fee         = 2.0;  		
  this.block.fee_step         = 0.000165;
  this.block.difficulty       = 0.0;
  this.block.paysplit         = 0.5;
  this.block.treasury         = 21000000.0;
  this.block.coinbase         = 100;


  ////////////
  // voting //
  ////////////
  this.block.paysplit_vote    = 0;     // -1 reduce miner payout
                                       //  0 no change
                                       //  1 increase miner payout


  ////////////////////////////
  // not included in blocks //
  ////////////////////////////
  this.transactions                  = []; 	// array of objects not json
  this.confirmations                 = conf;    // number of confirmations


  ///////////////
  // callbacks //
  ///////////////
  this.callbacks                     = [];
  this.callbacksTx                   = [];


  //////////////////////
  // import from JSON //
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








Block.prototype.debugHTML = function debugHTML() {


  html  = '<table class="block_table">';
  html += '<tr><td>id</td><td>'+this.block.id+'</td></tr>';
  html += '<tr><td>hash</td><td>'+this.hash('hex')+'</td></tr>';
  html += '<tr><td>unixtime</td><td>'+this.block.unixtime+'</td></tr>';
  html += '<tr><td>previous block</td><td><a href="/info/block?bid='+this.block.id+'">'+this.block.prevhash+'</a></td></tr>';
  html += '<tr><td>creator</td><td><a href="/info/address?add='+this.block.miner+'">'+this.block.miner+'</a></td></tr>';
  html += '<tr><td>burn fee</td><td>'+this.block.burn_fee+'</td></tr>';
  html += '<tr><td>fee step</td><td>'+this.block.fee_step+'</td></tr>';
  html += '<tr><td>difficulty</td><td>'+this.block.difficulty+'</td></tr>';
  html += '<tr><td>treasury</td><td>'+this.block.treasury+'</td></tr>';
  html += '<tr><td>coinbase</td><td>'+this.block.coinbase+'</td></tr>';
  html += '</table>';

  if (this.block.transactions.length > 0) {

    html += '<p></p>';

    html += '<b>Bundled Transactions:</b>';
    html += '<p></p>';

    html += '<table class="block_transactions_table">';
    html += '<tr>';
    html += '<th>id</th>';
    html += '<th>sender</th>';
    html += '<th>amount</th>';
    html += '<th>fee</th>';
    html += '<th>golden ticket</th>';
    html += '</tr>';

    for (mt = 0; mt < this.block.transactions.length; mt++) {

      tmptx = new saito.transaction(this.block.transactions[mt]);

      html += '<tr>';
      html += '<td><a href="/info/transaction?tid='+tmptx.transaction.id+'">'+tmptx.transaction.id+'</a></td>';
      html += '<td><a href="/info/address?add='+tmptx.transaction.from[0].add+'">'+tmptx.transaction.from[0].add+'</a></td>';
      html += '<td>'+tmptx.returnAmountTo(tmptx.transaction.to[0].add)+'</td>';
      html += '<td>'+tmptx.returnFee()+'</td>';
      if (tmptx.transaction.gt != null) {
        html += '<td>1</td>';
      } else {
        html += '<td>0</td>';
      }
      html += '</tr>';
    }
    html += '</table>';

  }

  return html;

}






Block.prototype.hash = function hash(enc) {
  return this.app.crypt.hash( this.signatureSource() );
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

Block.prototype.containsTransactionFor = function containsTransactionFor(publickey) {
  for (rd = 0; rd < this.transactions.length; rd++) {
    if (this.transactions[rd].involvesPublicKey(publickey) == 1) { return 1; }
  }
  return 0;
}



Block.prototype.signatureSource = function signatureSource() {

  return this.block.unixtime
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

}










////////////////////////////////////
// Creating and Validating Blocks //
////////////////////////////////////
Block.prototype.validate = function validate() {

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
  // lite nodes skip as lack transactions
  //
  if (this.block.transactions.length > 0) {
    if (this.validateTransactionFeesAdequate() == 0) {
      console.log("Block invalid: transaction fees inadequate");
      return 0;
    }
  }

  // check if golden ticket is valid and reflects block data
  if (this.validateGoldenTicket() == 0) {
    console.log("Block invalid: contains invalid golden ticket");
    this.app.blockchain.mempool.removeGoldenTicket();
    return 0;
  }

  // confirm that each transaction verifies, this is the 
  // last step as we need to check that the inputs exist
  // which requires the ability to tell our application 
  // through a callback if thre is a validation error
  for (zz = 0; zz < this.transactions.length; zz++) {
    if (this.transactions[zz].validate(this.app, this.block.paysplit_vote) != 1) {
      console.log("Block invalid: contains invalid transaction");
      console.log(this.transactions[zz].transaction);
      return 0;
    }

    // NOTE -- we do not validate the accuracy of transaction
    // inputs at this stage, because this is slow and requires
    // asynchronous database access. So we initiate a check
    // at the end of the blockchain indexAndStore() function
    //
    // if an invalid transaction input is found, the entire 
    // block is then removed and the longest_chain is reverted
    // to the block prior to it.
    //
    // this way we don't need to have exceedingly complex tests
    // to check the validity of transaction inputs on forks 
    // up-until the point that we have a new longest chain, in 
    // which case we can compare against the oldest longest chain. 

  }


  // validate new burn_fee and fee_step
  if (this.block.prevhash != "") {
    prevblk = this.app.blockchain.returnBlockByHash(this.block.prevhash);
    if (prevblk != null) {
      newbf = this.calculateBurnFee(prevblk.returnBurnFee(), prevblk.returnFeeStep());
      if (newbf[0] != this.block.burn_fee) {
        console.log("Block invalid: burn fee miscalculated: "+newbf[0]+" versus "+this.block.burn_fee);
        return 0;
      }
      if (newbf[1] != this.block.fee_step) {
        console.log("Block invalid: fee step miscalculated: "+newbf[1]+" versus "+this.block.fee_step);
        return 0;
      }
    }
  }



  return 1;
}

Block.prototype.areTransactionFeesAdequate = function areTransactionFeesAdequate() {

  unixtime_start = this.app.blockchain.returnUnixtime(this.block.prevhash);
  unixtime_current = this.block.unixtime;
  ts_bf = this.returnBurnFee();
  ts_fs = this.returnFeeStep();

  var transaction_fees_needed = this.calculateTransactionFeesNeeded(unixtime_start, unixtime_current, ts_bf, ts_fs);
  var usable_transaction_fees   = 0;

  for (i = 0; i < this.block.transactions.length; i++) {
    usable_transaction_fees += this.transactions[i].returnUsableFee();
  }
  if (transaction_fees_needed > usable_transaction_fees) {
    return 0;
  }

  return 1;

}
// differs from areTransactionFeesAdequate as it uses the burn_fee and fee_step of the 
// previous block. this function is used when validating our own blocks. Are transactionFeesAdequate
// can be used when looking forward
Block.prototype.validateTransactionFeesAdequate = function validateTransactionFeesAdequate() {

  // if this is our first block, we validate
  if (this.block.prevhash == "") { return 1; }
  tmpprevblock = this.app.blockchain.returnBlockByHash(this.block.prevhash);
  if (tmpprevblock == null) { return 1; }

  // otherwise calculate
  unixtime_start = this.app.blockchain.returnUnixtime(this.block.prevhash);
  unixtime_current = this.block.unixtime;
  ts_bf = tmpprevblock.returnBurnFee();
  ts_fs = tmpprevblock.returnFeeStep();

  var transaction_fees_needed = this.calculateTransactionFeesNeeded(unixtime_start, unixtime_current, ts_bf, ts_fs);
  var usable_transaction_fees   = 0;

  for (i = 0; i < this.block.transactions.length; i++) {
    usable_transaction_fees += this.transactions[i].returnUsableFee();
  }
  if (transaction_fees_needed > usable_transaction_fees) {
    return 0;
  }

  return 1;

}








Block.prototype.createBlock = function createBlock(prevblock=null) {

  //////////////////////////////
  // alphabetize transactions //
  //////////////////////////////
  this.transactions.sort();


  //////////////////////////////
  // add sequential block IDs //
  //////////////////////////////
  if (prevblock == null) {
    this.block.id = 1;
  } else {
    this.block.id = prevblock.block.id+1;
  }


  ////////////////////////////////////
  // add sequential transaction IDs //
  ////////////////////////////////////
  var mtid = 0;
  if (prevblock != null) { mtid = prevblock.returnMaxTxId(); }
  for (i = 0; i < this.transactions.length; i++) {
    mtid++;
    this.transactions[i].transaction.id = mtid;
  }


  /////////////////////////////
  // insert transaction json // 
  /////////////////////////////
  for (i = 0; i < this.transactions.length; i++) {
    this.block.transactions[i] = this.transactions[i].returnTransactionJson();
  }


  ////////////////////////
  // set default values //
  ////////////////////////
  if (this.transactions.length == 0) { 
    this.block.roothash   = "";
  } else {
    this.block.roothash   = this.app.crypt.merkleTree(this.block.transactions).root;
  }

  this.block.miner        = this.app.wallet.returnPublicKey();

  if (prevblock != null) {
    this.block.coinbase   = prevblock.block.coinbase;  // not adjusted unless golden ticket found below
    this.block.treasury   = prevblock.block.treasury;  // not adjusted unless golden ticket found below
    this.block.prevhash   = prevblock.hash();
    this.block.difficulty = prevblock.returnDifficulty();
    this.block.paysplit   = prevblock.returnPaysplit();
    this.block.burn_fee   = prevblock.returnBurnFee();
    this.block.fee_step   = prevblock.returnFeeStep();
  }

  // set initial consensus variables if this is
  // our genesis block
  if (this.block.id == 1) {
    this.block.prevhash   = "";
    this.block.paysplit   = 0.5;
    this.block.difficulty = 0.1875;
  }


  ///////////////////////////////
  // adjust consensus settings //
  ///////////////////////////////
  this.handleGoldenTicket();
  newbf = this.calculateBurnFee(this.block.burn_fee, this.block.fee_step);
  this.block.burn_fee = newbf[0];
  this.block.fee_step = newbf[1];



  ///////////////////////////////
  // set our vote for paysplit //
  ///////////////////////////////
  this.block.paysplit_vote   = this.app.blockchain.voter.returnPaysplitVote(this.block.paysplit);


  /////////////////////////////////////
  // add to blockchain and propagate //
  /////////////////////////////////////
  //
  // 1 = propagate after validation
  //
  this.app.blockchain.addBlock(this, 1);

}




////////////////////////////////
// Transaction Fee Management //
////////////////////////////////
Block.prototype.calculateTransactionFeesNeeded = function calculateTransactionFeesNeeded(ts_start, ts_issue, ts_burn_fee, ts_fee_step) {

  var unixtime_original        = ts_start;
  var unixtime_current         = ts_issue;
  var milliseconds_since_block = unixtime_current - unixtime_original;
  var feesneeded = ( ts_burn_fee - (ts_fee_step * milliseconds_since_block) );

  if (feesneeded < 0) { feesneeded = 0; }

  return feesneeded.toFixed(8);

}

Block.prototype.calculateUsableTransactionFees = function calculateUsableTransactionFees() {

  var total_usable_fees = 0;
  for (zz = 0; zz < this.transactions.length; zz++) {
    total_usable_fees += this.transactions[zz].returnUsableFee();
  }
  return total_usable_fees.toFixed(8);

}









//////////////////////////////
// Golden Ticket Management //
//////////////////////////////
//
// we want to reward nodes transmitting data across the network
// not simply originators and recipients of email. Anyone who 
// either BUNDLEs a block or propagates a transaction used 
// to bundle a block is a contender
//
Block.prototype.returnGoldenTicketContenders = function returnGoldenTicketContenders() {

  var children = [];

  for (v = 0; v < this.transactions.length; v++) {
    if (this.transactions[v].transaction.path.length == 0) {

      // if there is no path length, the transaction is from us and 
      // we get to add ourselves as a candidate
      children.push(this.transactions[v].transaction.from[0].add);

    } else {

      // otherwise, we pick the destination node in each hop through
      // the transmission path. this eliminates the sender and keeps
      // the focus on nodes that actively transmitted the message    
      for (x = 0; x < this.transactions[v].transaction.path.length; x++) {
        children.push(this.transactions[v].transaction.path[x].to);
      }
    }
  }

  return children;
}
Block.prototype.handleGoldenTicket = function handleGoldenTicket() {

  // check to see if we have a golden ticket in this block
  for (i = 0; i < this.transactions.length; i++) {
    if (this.transactions[i].transaction.gt != null) {

      gtix = new saito.goldenticket(this.app, JSON.stringify(this.transactions[i].transaction.gt));

      // our two votes
      this.block.paysplit    = gtix.calculatePaysplit(this);
      this.block.difficulty  = gtix.calculateDifficulty(this);

      monetary_policy        = gtix.calculateMonetaryPolicy(this);

      this.block.treasury    = monetary_policy[0];
      this.block.coinbase    = monetary_policy[1];

      // we should have already checked that there is 
      // only one golden ticket in this block when 
      // validating the block. For sanity's stake, we
      // only process one golden ticket by default 
      i = this.transactions.length + 10;

    }
  }
}
Block.prototype.calculateBurnFee = function calculateBurnFee(starting_burn_fee, starting_fee_step) {

  bf    = [];
  bf[0] = starting_burn_fee;
  bf[1] = starting_fee_step;

  var current_unixtime = this.block.unixtime;
  var prevblk_unixtime = this.app.blockchain.returnUnixtime(this.block.prevhash);

  if (prevblk_unixtime == -1) { return bf; }

  block_time  = current_unixtime - prevblk_unixtime;
  target_time = this.app.blockchain.heartbeat * 1000;

  // faster than target
  if (target_time > block_time) {

    bf[0] += 0.0001;
    bf[1]  = bf[0] / (this.app.blockchain.max_heartbeat * 1000);
    bf[1]  = bf[1].toFixed(8);

  } else { if (target_time < block_time) {

    bf[0] -= 0.0001;
    if (bf[0] < 2) { bf[0] = 2; }
    bf[1]  = bf[0] / (this.app.blockchain.max_heartbeat * 1000);
    bf[1]  = bf[1].toFixed(8);

  } }

  return bf;

}



Block.prototype.validateGoldenTicket = function validateGoldenTicket() {

  prevblk = this.app.blockchain.returnBlockByHash(this.block.prevhash);
  gtix    = null;


  // lite clients cannot always validate Golden Tickets because they 
  // may not have the previous block. skip validating if we do not
  // have the previous block.
  if (prevblk == null) {
    //console.log("Previous Block is NULL -- light clients need to be able to validate blocks without checking GT information");
    return 1;
  }

  

  // check to see if we have a golden ticket in this block
  goldenticketcount = 0;
  for (bli = 0; bli < this.transactions.length; bli++) {
    if (this.transactions[bli].transaction.gt != null) {
      goldenticketcount++;
      // validate golden ticket signature
      gtix = new saito.goldenticket(this.app, JSON.stringify(this.transactions[bli].transaction.gt));
      if (gtix.validate(prevblk, this) == 0) {
	console.log("Block invalid: golden ticket does not validate");
	return 0;
      }
    }
  }

  if (goldenticketcount > 1) {
    console.log("Block invalid: has more than one golden ticket");
    return 0;
  }


  // no golden ticket
  if (gtix == null) {

    // difficulty, paysplit, coinbase and treasury should be 
    // identical to previous block
    if (this.returnTreasury() != prevblk.returnTreasury()) {
      console.log("Block invalid: no golden ticket yet treasury differs");
      return 0;
    }
    if (this.returnCoinbase() != prevblk.returnCoinbase()) {
      console.log("Block invalid: no golden ticket yet coinbase differs");
      return 0;
    }
    if (this.returnPaysplit() != prevblk.returnPaysplit()) {
      console.log("Block invalid: no golden ticket yet paysplit differs");
      return 0;
    }
    if (this.returnDifficulty() != prevblk.returnDifficulty()) {
      console.log("Block invalid: no golden ticket yet difficulty differs");
      return 0;
    }

    return 1;
  }



  // validate paysplit and difficulty
  if (prevblk != null) {
    if (this.returnDifficulty() != gtix.calculateDifficulty(prevblk)) {
      console.log("Block invalid: difficulty adjustment is incorrect");
      return 0;
    }
    if (this.returnPaysplit() != gtix.calculatePaysplit(prevblk)) {
      console.log("Block invalid: paysplit adjustment is incorrect");
      return 0;
    }
  }



  // validate monetary policy
  if (gtix.validateMonetaryPolicy(this.returnTreasury(), this.returnCoinbase(), prevblk) != 1) {
    console.log("Block invalid: monetary policy does not validate");
    return 0;
  }


  return 1;

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
Block.prototype.updateConfirmationNumberWithoutCallbacks = function updateConfirmationNumberWithoutCallbacks(confnum) {
  if (confnum > this.confirmations) {
    this.confirmations = confnum;
  }
}
Block.prototype.runCallbacks = function runCallbacks(confnum) {
  for (cc = this.confirmations+1; cc <= confnum; cc++) {
    for (ztc = 0; ztc < this.callbacks.length; ztc++) {
      this.callbacks[ztc](this.transactions[this.callbacksTx[ztc]], cc, this.app);
    }
  }
  this.confirmations = confnum;
}







Block.prototype.involvesPublicKey = function involvesPublicKey(publickey) {
  for (vsd = 0; vsd < this.transactions.length; vsd++) {
    if (this.transactions[vsd].involvesPublicKey(publickey) == 1) {
      return 1;
    }
  }
  return 0;
}








Block.prototype.addTransaction = function addTransaction(tx) {
  this.block.transactions.push(JSON.stringify(tx));
  this.transactions.push(tx);
}
Block.prototype.importTransaction = function importTransaction(txjson) {
  tx = new saito.transaction(txjson);
  this.addTransaction(tx);
}
Block.prototype.returnTreasury = function returnTreasury() {
  return this.block.treasury;
}
Block.prototype.returnCoinbase = function returnCoinbase() {
  return this.block.coinbase;
}


Block.prototype.decryptTransactions = function decryptTransactions() {
  for (vsd = 0; vsd < this.transactions.length; vsd++) {
    if (this.transactions[vsd].involvesPublicKey(this.app.wallet.returnPublicKey()) == 1) {
      this.transactions[vsd].decryptMessage(this.app);
    }
  }
}



