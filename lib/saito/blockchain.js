var saito   = require('../saito');




function Blockchain(app) {

  if (!(this instanceof Blockchain)) { return new Blockchain(app); }

  this.app     = app || {};

  this.mempool = new saito.mempool(this.app);
  this.miner   = new saito.miner(this.app);
  this.voter   = new saito.voter(this.app);


  /////////////////////////
  // Consensus Variables //
  /////////////////////////
  this.heartbeat               = 30;        // expect new block every 30 seconds
  this.max_heartbeat           = 120;       // burn fee hits zero every 120 seconds
  this.genesis_period          = 90000;     // number of blocks before money disappears
					    // 90,000 is roughly a 30 day transient
					    // blockchain.
  this.genesis_ts              = 0;         // unixtime of earliest block
  this.genesis_block_id        = 0;         // earlier block_id we care about
  this.fork_guard              = 120;       // discard forks that fall N blocks behind
  this.fork_id                 = "";        // a string we use to identify our longest-chain
  this.fork_id_mod             = 10;	    // update fork id every 10 blocks

  ///////////////////
  // Longest Chain //
  ///////////////////
  this.longestChain            = -1; // position of longest chain in indices
  this.validTransactions       = -1;  	// -1 unknown
					//  1 valid
					//  0 invalid

  ////////////
  // Blocks //
  ////////////
  this.blocks                  = [];



  ////////////////////////////
  // Transaction Validation //
  ////////////////////////////
  this.validate_total       = 0;
  this.validate_current     = 0;


  //////////////////
  // Bloom Filter //
  //////////////////
  this.blockbloom              = new saito.bloom(8 * 1024 * 1024, 16, 0xdeadbee0);
  this.blockbloom_2            = new saito.bloom(8 * 1024 * 1024, 16, 0xdeadbee0);
  this.blockbloom_count        = 0;

  /////////////
  // Indexes //
  /////////////
  //
  // when adding an index, be sure to edit
  //
  //    indexAndStore (which adds it)
  //    purgeArchivedData (which deletes it)
  //    deIndexAndPurge (removing bad blocks)
  //
  this.index = {
    hash:     [],                       // hashes
    prevhash: [],                       // hash of previous block
    block_id: [],                       // block id
    ts:       [],                       // timestamps
    lc:       [],                       // is longest chain (0 = no, 1 = yes)
    burnfee:  [],                       // burnfee per block
  };


  ///////////////////////
  // avoiding problems //
  ///////////////////////
  this.currently_indexing = 0;
  this.currently_deindexing = 0;
  this.missing_block_ts_limit = -1;

  return this;

}
module.exports = Blockchain;





////////////////
// Initialize //
////////////////
Blockchain.prototype.initialize = function initialize() {

  ///////////////////////////////////////
  // fill indexes with archived blocks //
  ///////////////////////////////////////
  this.app.storage.indexRecentBlocks(this.genesis_period+this.fork_guard);

}





///////////
// Debug // -- print out the longest chain
///////////
Blockchain.prototype.debug = function debug() {

  for (var mb = 0; mb < this.blocks.length; mb++) {
    var longestchainhash = this.index.hash[this.longestChain];
    if (longestchainhash == this.blocks[mb].hash()) {
      console.log("***** " + this.blocks[mb].block.id + " (" + this.blocks[mb].block.unixtime + ") -- " + this.blocks[mb].hash() + "  ----->  " + this.blocks[mb].block.prevhash);
    } else {
      console.log(this.blocks[mb].block.id + " (" + this.blocks[mb].block.unixtime + ") -- " + this.blocks[mb].hash() + "  ----->  " + this.blocks[mb].block.prevhash);
    }
  }

console.log("");

}
Blockchain.prototype.debugHTML = function debugHTML() {

  var html  = '<table class="blockchain_table">';
  html += '<tr><th></th><th>id</th><th>block hash</th><th>previous block</th></tr>';


  for (var mb = this.blocks.length-1; mb >= 0 && mb > this.blocks.length-200; mb--) {
    html += '<tr>';
    var longestchainhash = this.index.hash[this.longestChain];
    if (longestchainhash == this.blocks[mb].hash()) {
      html += '<td>*</td><td><a href="/info/block?hash='+this.blocks[mb].hash('hex')+'">'+this.blocks[mb].block.id+'</a></td><td><a href="/info/block?bid='+this.blocks[mb].block.id+'">'+this.blocks[mb].hash()+'</a></td><td>'+this.blocks[mb].block.prevhash.substring(0,25)+'...</td>';
    } else {
      html += '<td></td><td><a href="/info/block?hash='+this.blocks[mb].hash('hex')+'">'+this.blocks[mb].block.id+'</td><td><a href="/info/block?bid='+this.blocks[mb].block.id+'">'+this.blocks[mb].hash()+'</a></td><td>'+this.blocks[mb].block.prevhash.substring(0,25)+'...</td>';
    }
    html += '</tr>';
  }
  html += '</table>';

  return html;
}










//////////////////////
// Block Management //
//////////////////////
//
// indexAndStore is where we take the actual block and stick
// it into our in-mempory blockchain (both the indexes and the
// queue of full-blocks.
//
// after inserting a block, this function also checks whether it
// forms the longest chain and updates our indexed array
//
Blockchain.prototype.indexAndStore = function indexAndStore(newblock, forceAdd="no") {

  if (newblock == null) {
    console.log("BLOCK IS NULL"); 
    return 0; 
  }
  if (this.currently_deindexing == 1) { 
    console.log("CURRENTLY DE-INDEXING"); 
    return 0; 
  }
  if (this.currently_indexing == 1)   { 
    console.log("CURRENTLY INDEXING");
    return 0; 
  }
  this.currently_indexing = 1;

  console.log("Adding block "+newblock.returnId() + " -> " + newblock.hash() + " " + newblock.block.unixtime);

  var hash           = newblock.hash('hex');
  var ts             = newblock.block.unixtime;
  var prevhash       = newblock.block.prevhash;
  var block_id       = newblock.block.id;
  var existing_longestChain = this.longestChain;

  // if the timestamp for this block is BEFORE our genesis block, we
  // refuse to process it out of principle. Our sorting algorithm will
  // still accept orphan chains that post-date our genesis block, but
  // will not try to find blocks with timestamps earlier than our
  // genesis block in order to avoid the longest-chain competition
  // from requiring the full block.
  if (ts < this.genesis_ts) {

    // we make an exception for blocks we are "forced" to add
    // for instance if we are replenishing our history from a
    // database backup, as otherwise the first block added will
    // prevent earlier blocks from being added
    if (forceAdd != "force") {
      this.currently_indexing = 0;
      return 0;
    }
  }


  if (this.isHashIndexed(hash) == 1) {
    //console.log("Block Hash: "+hash+" matches hash in transaction history...");
    this.currently_indexing = 0;
    return 0;
  }



  ////////////////////
  // missing blocks //
  ////////////////////
  //
  // if we are adding our first block, we set this as 
  // the ts_limit to avoid requesting missing blocks
  // ad infinitum into the past.
  //
  // but we accept earlier blocks if they are being
  // force-added on boot.
  //
  if (this.missing_block_ts_limit == -1) {
    this.missing_block_ts_limit = newblock.block.unixtime;
  } else {
    if (this.missing_block_ts_limit > newblock.block.unixtime && forceAdd != "no") {
      this.missing_block_ts_limit = newblock.block.unixtime;
    }
  }
  // if our previous block hash was not indexed and our timestamp
  // is greater than the current genesis block, then we sent a
  // request out into the network to ask for it.
  if (prevhash != "") {
    //
    // do not request previous missing block if we are already
    // further back than the limit.
    // 
    if (this.missing_block_ts_limit <= newblock.block.unixtime) {
      if (this.isHashIndexed(prevhash) == -1) {
        var response           = {};
        response.request   = "missing block";
        response.data      = {};
        response.data.hash = prevhash;
        this.app.network.sendRequest(response.request, JSON.stringify(response.data));
      }
    }
  }



  ////////////////////
  // insert indexes //
  ////////////////////
  // replace compareTs with an in-lined function
  var pos = this.binaryInsert(this.index.ts, ts, function(a,b) { return a -b;});
  this.index.hash.splice(pos, 0, hash);
  this.index.prevhash.splice(pos, 0, prevhash);
  this.index.block_id.splice(pos, 0, block_id);
  this.index.lc.splice(pos, 0, 0);              // set longest chain to 0 until we know it is longest chain
  this.index.burnfee.splice(pos, 0, newblock.returnBurnFee());


  //////////////////
  // insert block //
  //////////////////
  var blkpos   = 0;
  var found    = 0;


  // we use a separate search since we purge our blocks
  // after a certain amount of time (separately from the 
  // purge of old data from the blockchain)
  for (i = this.blocks.length-1; i >= 0 && found == 0; i--) {
    if (newblock.block.unixtime > this.blocks[i].block.unixtime) {
      blkpos = i+1;
      found = 1;
    }
  }
  this.blocks.splice(blkpos, 0, newblock);
 


  /////////////////////////
  // add to bloom filter //
  /////////////////////////
  this.blockbloom.add(newblock.hash('hex'), 'hex');



  //////////////////////////////////////////////////////////
  // if this is our first block, it is longest by default //
  //////////////////////////////////////////////////////////
  if (this.longestChain == -1) { this.longestChain = 0; }





  //////////////////////////////////////////////
  // decrypt any transactions intended for us //
  //////////////////////////////////////////////
  //
  // we handle during indexing to avoid any
  // validation errors, as the decrypted block/tx
  // will not validate
  //
  newblock.decryptTransactions();
  



  ///////////////////////////////////////////
  // tell our block to affix its callbacks //
  ///////////////////////////////////////////
  this.blocks[blkpos].affixCallbacks();
  








  /////////////////////////////
  // track the longest chain //
  /////////////////////////////
  var i_am_the_longest_chain = 0;
  var shared_ancestor_index_pos = -1;
  var validate_transactions = -1;



  // if we inserted our item earlier than our existing longest item, then we need
  // to adjust our longestChain variable forward by one so that the current
  // longestChain still points to the same item in the index
  if (pos <= this.longestChain) {
    this.longestChain++;
    if (this.longestChain >= this.index.hash.length) {
      this.longestChain--;
    }
  }


  // if genesis block, set as longest chain
  if (prevhash == "" && this.index.prevhash.length == 1) {
    this.longestChain == 0;
    i_am_the_longest_chain = 1;
  }


  /////////////////////////////
  // update the longestChain //
  /////////////////////////////

  // but only if block_id is bigger than
  // our current
  //
  // this means SPV nodes will ignore
  // payments for their address BEFORE
  // they started scanning (avoids wallet
  // desynchronization)
  //
  if (block_id >= this.index.block_id[this.longestChain]) {
  if (prevhash == this.index.hash[this.longestChain]) {

    // if our previous hash is the longest chain, this
    // is the longest chain by default
    this.longestChain = pos;
    i_am_the_longest_chain = 1;

    if (forceAdd != "force") { validate_transactions = 1; }

  } else {
 

    // otherwise, we find the last shared ancestor and
    // calculate the length and aggregate burn fee of
    // the two competing chains to determine which is 
    // preferred

    var lchain_pos = this.longestChain;
    var nchain_pos = pos;
    var lchain_len = 0;
    var nchain_len = 0;
    var lchain_brn = this.index.burnfee[lchain_pos];
    var nchain_brn = this.index.burnfee[nchain_pos];
    var lchain_ts  = this.index.ts[lchain_pos];
    var nchain_ts  = this.index.ts[nchain_pos];
    var lchain_ph  = this.index.prevhash[lchain_pos];
    var nchain_ph  = this.index.prevhash[nchain_pos];

    var search_pos = null;
    var search_ts  = null;
    var search_hash= null;
    var search_ph  = null;
    var search_brn = null;

    // determine starting search position
    if (nchain_ts >= lchain_ts) {
      search_pos = nchain_pos-1;
    } else {
      search_pos = lchain_pos-1;
    }


    while (search_pos >= 0) {

      search_ts    = this.index.ts[search_pos];
      search_hash  = this.index.hash[search_pos];
      search_ph    = this.index.prevhash[search_pos];
      search_brn   = this.index.burnfee[search_pos];

      if (search_hash == lchain_ph && search_hash == nchain_ph) {

        console.log("Common ancestor at index POS: "+search_pos);

        // if non-zero target, this is common ancestor
        shared_ancestor_index_pos = search_pos;
        search_pos = -1;

      } else {

        if (search_hash == lchain_ph) {
          lchain_len++;
          lchain_ph    = this.index.prevhash[search_pos];
	  lchain_brn  += this.index.burnfee[search_pos];
        }
        if (search_hash == nchain_ph) {
          nchain_ph    = this.index.prevhash[search_pos];
          nchain_len++;
	  nchain_brn  += this.index.burnfee[search_pos];
        }

	// if zero target
	shared_ancestor_index_pos = search_pos;
        search_pos--;

      }

    }


    if (nchain_len > lchain_len && nchain_brn >= lchain_brn) {
      //
      // compare length and burn fees
      //
      // in order to prevent our system from being gamed, we
      // require the attacking chain to have equivalent
      // or greater aggregate burn fees. This ensures that
      // an attacker cannot lower difficulty, pump out a
      // ton of blocks, and then hike the difficulty only
      // at the last moment.
      
      console.log("UPDATING LONGEST CHAIN: "+nchain_len + " new |||||| " + lchain_len + " old 1");
      i_am_the_longest_chain = 1;
      this.updateLongestChain(newblock, shared_ancestor_index_pos, nchain_len, lchain_len, forceAdd);
      validate_transactions = nchain_len;

      // this must be updated after calling updateLongestChain
      this.longestChain = pos;
      this.app.modules.updateBalance();

    } else {

      // if the new chain is exactly the same length as the working longest chain
      // but matches our preferences more closely, we want to support it by
      // mining or building upon it.
      if (nchain_len == lchain_len && nchain_brn >= lchain_brn) {

        latestBlock = this.returnLatestBlock();
        if (latestBlock != null) {

          if (this.voter.prefers(newblock, latestBlock)) {

            console.log("UPDATING LONGEST CHAIN W/ PREFERENCE: "+nchain_len + " new |||||| " + lchain_len + " old 2");
            i_am_the_longest_chain = 1;
            this.updateLongestChain(newblock, shared_ancestor_index_pos, nchain_len, lchain_len, forceAdd);
            validate_transactions = nchain_len;

	    // this must be updated after calling updateLongestChain
            this.longestChain = pos;
            this.app.modules.updateBalance();
          }
        }
      }
    }
  }
  }


  // start mining new block
  if (i_am_the_longest_chain == 1) {

console.log("BLOCK added to longest chain: "+newblock.hash('hex'));

    // resume mining
    this.index.lc[pos] = 1;
    this.miner.stopMining();
    this.miner.startMining(newblock);

    // update our options with our latest block ID
    this.app.options.blockchain = this.returnBlockchain();
    this.app.storage.saveOptions();

  }







  // write latest block data to long-term storage
  // if we don't already have it in our database
  //
  // remember to specify if this is the longest chain
  // in order to help us simplify tracking which 
  // payment slips are spendable on which chain
  this.app.storage.saveBlock(newblock, i_am_the_longest_chain);



  /////////////////////////////////////////////////////
  // tell our wallet about any money intended for us //
  /////////////////////////////////////////////////////
  for (var ti = 0; ti < newblock.transactions.length; ti++) {
    var tx = newblock.transactions[ti];
    if (tx.isFrom(this.app.wallet.returnPublicKey()) || tx.isTo(this.app.wallet.returnPublicKey())) {
      this.app.wallet.paymentConfirmation(newblock, tx, i_am_the_longest_chain);
    }
  }
  this.app.wallet.resetSpentInputs();




  /////////////////////////////////////////////
  // now run the callbacks for longest chain //
  /////////////////////////////////////////////
  //
  // we only run the callbacks if we are not 'force' loading
  // from a database. In that case we avoid triggering the
  // callbacks as we have presumably already processed them
  // when we inserted the block into the database in the
  // first place
  //
  // once we are done, we update the number of confirmations
  // that our block has in the database. this is used for 
  // pruning the money supply and letting us arbitrarily
  // search for the longest chain at any block_depth by
  // picking the one with the most confirmations.
  //
  // we only run callbacks on the first 100 confirmations
  //
  if (forceAdd != "force") {
    var our_longest_chain = this.returnLongestChainIndex(100);
    for (var i = 0; i < our_longest_chain.length && i < 100; i++) {
      var thisblk = this.returnBlockByHash(this.index.hash[our_longest_chain[i]]);
      if (thisblk != null) {
        thisblk.runCallbacks(i);
        this.app.storage.saveConfirmation(thisblk.hash(), i);
      } else {
	// error finding block - maybe we deleted it
      }
    }
  } else {

    // if we are forcing blocks into our blockchain, we have already
    // run the callbacks, and want to at least update their conf
    // variable so they don't repeat work that is already done once
    // they execute again.
    var our_longest_chain = this.returnLongestChainIndex(100);
    for (var i = 0; i < our_longest_chain.length; i++) {
      var thisblk = this.returnBlockByHash(this.index.hash[our_longest_chain[i]]);
      thisblk.updateConfirmationNumberWithoutCallbacks(i);
    }

  }


  /////////////////////////////////////
  // sometimes we update our fork id //
  /////////////////////////////////////
  if (newblock.returnId()%this.fork_id_mod == 0) {
    this.updateForkId(newblock);
  }


  /////////////////////////////////
  // we update the genesis block //
  /////////////////////////////////
  if (newblock.returnId() >= (this.genesis_block_id+this.genesis_period+this.fork_guard)) {
    this.updateGenesisBlock(newblock);
  }


  ///////////////////////////
  // run one-time callback //
  ///////////////////////////
  if (forceAdd != "force") {
    this.app.modules.onNewBlock(newblock);
  }



  ///////////////////////////
  // update wallet balance //
  ///////////////////////////
  this.app.wallet.updateBalance();



  /////////////////////////////////
  // validate block transactions //
  /////////////////////////////////
  if (validate_transactions == -1) {

    this.currently_indexing = 0;
    this.validate_total = 0;
    this.validate_current = 0;

  } else {

    // we only finish validating this block once all of the
    // transactions have been validated by our storage class
    // in which case currently_indexing is updated to zero and
    // we can process the next block.
    var nbhasharr = [];
    nbhasharr.push(newblock.hash('hex'));

    // validating transactions
    this.validate_total          = newblock.transactions.length;
    this.validate_current        = 0;

    if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) {
      this.validate_current = newblock.transactions.length-1;
      this.successfulBlockTransactionValidation(this.app);
    } else {
      this.app.storage.validateTransactionInputs(newblock, nbhasharr, existing_longestChain, 2, validate_transactions);
    }
  }


  //////////////////////////////////
  // allow further block bundling //
  //////////////////////////////////
  this.mempool.removeGoldenTicket();
  this.mempool.processing_bundle = 0;

}

Blockchain.prototype.successfulBlockTransactionValidation = function successfulBlockTransactionValidation(app, tx=null) {
  app.blockchain.validate_current++;
  if (app.blockchain.validate_current >= app.blockchain.validate_total) {
    app.blockchain.currently_indexing = 0;
  }
}
Blockchain.prototype.failedBlockTransactionValidation = function failedBlockTransactionValidation(blk, tx, old_lc, lchain_len) {

  console.log("\n\nBAD TRANSACTION results in BLOCK PURGE\n\n");
  console.log("BK HS: "+blk.hash('hex'));
  console.log("BK ID: "+blk.block.id);
  console.log("TX ID: "+tx.returnId());
  console.log("resetting longest chain to: "+old_lc);


  // restore longest chain
  blk.app.blockchain.index.lc[blk.app.blockchain.longestChain] = 0;
  blk.app.wallet.handleChainReorganization(blk.app.blockchain.index.block_id[blk.app.blockchain.longestChain], blk.app.blockchain.index.hash[blk.app.blockchain.longestChain], 0);
//console.log("resetting LongestChain status to 0 for: "+blk.hash('hex')+ " -- " +blk.block.id);

  blk.app.blockchain.longestChain = old_lc;
  var formerchain = blk.app.blockchain.returnLongestChainIndex(lchain_len);

  //blk.app.blockchain.rewriteLongestChainIndex(lchain_len, formerchain)
  blk.app.blockchain.rewriteLongestChainIndex(old_lc, formerchain)
  for (var fcl = 0; fcl < formerchain.length; fcl++) {
    blk.app.storage.saveLongestChainStatus(blk.app.blockchain.index.hash[formerchain[fcl]], blk.app.blockchain.index.block_id[formerchain[fcl]], 1);
    blk.app.wallet.handleChainReorganization(blk.app.blockchain.index.block_id[formerchain[fcl]], blk.app.blockchain.index.hash[formerchain[fcl]], 1);
  }
  blk.app.blockchain.resetMiner();


  // update blockchain info
  blk.app.blockchain.resetMiner();
  blk.app.blockchain.updateForkId(blk.app.blockchain.returnLatestBlock());
  blk.app.options.blockchain = blk.app.blockchain.returnBlockchain();
  blk.app.storage.saveOptions();



  // remove block and tx
  if (blk == null) {
    blk.app.blockchain.mempool.removeTransaction(tx);
  } else {
    blk.app.blockchain.mempool.removeTransaction(tx);
  }


  // reset variables so transaction validation can move forward
  blk.app.blockchain.validate_current = 0;
  blk.app.blockchain.validate_total = 0;;
  blk.app.blockchain.currently_indexing = 0;

console.log("values reset....");

}



Blockchain.prototype.resetMiner = function resetMiner() {

    var latestBlk = this.returnLatestBlock();

    // resume mining
    this.miner.stopMining();
   
    if (latestBlk != null) {
      this.miner.startMining(latestBlk);
    }

}


// this is ugly code that is used by the Storage class when 
// a block fails to validate and we need to re-write the 
// longest-Chain index to restore us back to the previous
// chain. 
//
// we have to have this two-step like approach to handling 
// the chain because database access is not necessarily 
// synchronous, so we can get reports of problems long after
// we have already added the block and propagated it.
Blockchain.prototype.rewriteLongestChainIndex = function rewriteLongestChainIndex(shared_ancestor_index_pos, correct_pos_array) {

  for (var h = shared_ancestor_index_pos+1; h < this.index.lc.length; h++) {
    this.index.lc[h] = 0;
    this.app.storage.saveLongestChainStatus(this.index.hash[h], this.index.block_id[h], 0);
  }

  for (var z = 0; z < correct_pos_array.length; z++) {
    this.index.lc[correct_pos_array[z]] = 1;
    this.app.storage.saveLongestChainStatus(this.index.hash[correct_pos_array[z]], this.index.block_id[correct_pos_array[z]], 1);
  }

  // HACK --
  //
  // we seem to reset everything properly to 0, but do not 
  // set the current block to longest_chain when rewriting
  // causing issues
  console.log("\n\nCORRECT POS ARRAY while REWRITING: ");
  console.log(correct_pos_array);
  console.log("\n\n");

}
Blockchain.prototype.updateLongestChain = function updateLongestChain(newblock, shared_ancestor_index_pos, nchain_len, lchain_len, forceAdd) {

  if (newblock.block.prevhash == "") { return; }
  if (shared_ancestor_index_pos > -1) {


    // reset to non-longest chain
    for (var h = shared_ancestor_index_pos+1; h < this.index.lc.length; h++) {
      this.index.lc[h] = 0;
console.log(" ... reset longest chain to 0 for " + this.index.block_id[h] + " ... " + this.index.hash[h]);
      this.app.storage.saveLongestChainStatus(this.index.hash[h], this.index.block_id[h], 0);
      this.app.wallet.handleChainReorganization(this.index.block_id[h], this.index.hash[h], 0);
    }


    var shared_ancestor_hash = this.index.hash[shared_ancestor_index_pos];


//HACK
    var hash_to_hunt_for = newblock.hash('hex');
//    var hash_to_hunt_for = newblock.block.prevhash;


    //var newchain = [];
    var new_block_hashes = [];

    for (var j = this.index.hash.length-1; j >= shared_ancestor_index_pos; j--) {
      if (this.index.hash[j] == hash_to_hunt_for) {
        //newchain.push(j);
        this.index.lc[j] = 1;
        hash_to_hunt_for = this.index.prevhash[j];
        this.app.storage.saveLongestChainStatus(this.index.hash[j], this.index.block_id[j], 1);
        this.app.wallet.handleChainReorganization(this.index.block_id[j], this.index.hash[j], 1);
        new_block_hashes.push(this.index.hash[j]);
      }
    }
  }
}








/////////////////////////////////////
// Disposible Blockchain Functions //
/////////////////////////////////////
//
// when the blockchain hits a certain length we throw out all of our older crap
// this is possible because block ids are incremental. We do check our last 100
// blocks to make sure there is not a block that might reference one of the
// blocks we are throwing out before we purge ourselves of this effort.
//
Blockchain.prototype.updateGenesisBlock = function updateGenesisBlock(blk) {

  // we need to make sure this is not a random block that is disconnected
  // from our previous genesis_id. If there is no connection between it
  // and us, then we cannot delete anything as otherwise the provision of
  // the block may be an attack on us intended to force us to discard
  // actually useful data.
  //
  // we handle this by only proceeding if the block is the head of the
  // verified longest chain.
  if (this.index.hash[this.longestChain] != blk.hash('hex')) {
    //console.log("we cannot verify that this is the longest chain when trying to update our genesis block, so abort");
    return;
  }
  if (this.index.hash.length < this.genesis_period) {
    //console.log("we do not have a full genesis period yet, refusing to purge anything");
    return;
  }


  // if our block id is greater than the genesis block plus our
  // expected block period plus our expected fork guard, we check
  // to see if we can throw out data we no longer need to worry about.
  if (blk.returnId() >= (this.genesis_block_id + this.genesis_period + this.fork_guard)) {

    // check the fork guard period to see if there is a viable
    // competing chain. If there is no viable competing chain
    // then just plow ahead.
    //
    // if there is a viable competing chain, delete the stuff
    // that isn't needed given our assumption that the lowest
    // block id may be a viable chain.
    var is_there_a_challenger = 0;

    var our_block_id    = blk.returnId();

    // -1 accounts for the fact we reclaim the funds from unspent
    // golden tickets, and need to know for sure that those slips
    // have not been spent when we calculate getting them back
    // into circulation. So we keep an extra block on the tail 
    // end, even if it is unspendable
    var lowest_block_id = our_block_id - this.genesis_period - 1;

    // we cannot delete anything if our new genesis block would
    // be lower than zero.
    if (lowest_block_id <= 0) { return; }

    // otherwise, figure out what the lowest block ID is from our
    // most recently produced list of blocks. We pick the number
    // here arbitrarily based on a fork_guard defined as a constant
    for (var c = 2; c <= this.fork_guard && c < this.index.block_id.length; c++) {
      if (this.index.block_id[this.index.block_id.length-c] < lowest_block_id) {
        lowest_block_id = this.index.block_id[this.index.block_id.length-2];
      }
    }

    // in a single chain, the lowest block ID should be the blkID of our
    // current block minus the genesis period. in a chain with some sort
    // of slow attack or a competing chain, there may be a lower block_id
    // that is still competitive but has not caught up as far as the main
    // block.
    //
    // in either case, we are OK to throw out everything below the
    // lowest_block_id that we have found, since even the lowest
    // fork in our guard_period will not need to access transactions
    // from before itself and the genesis period.
    var purgePoint = (lowest_block_id - this.genesis_period);


    // TODO
    //
    // in the future we want to figure out how much money has been lost and 
    // add EXACTLY that much back into the treasury. Since our data structure
    // is not well-designed for synchronous queries, we currently just add 
    // an arbitrary amount. This is handled in the BLOCK class.
    //
    // - unspent slips
    // - uncashed gts
    //
    //
    this.purgeArchivedData((purgePoint));


    // finally, update our genesis block_id to the current_block minus
    // the genesis period. We will run this function again when the
    // fork guard has passed, and if any forks have not sufficiently
    // kept pace in that time, they will be discarded them.
    this.genesis_block_id = blk.returnId() - this.genesis_period;

  }

}

Blockchain.prototype.returnLastSharedBlockId = function returnLastSharedBlockId(fork_id, latest_known_block_id) {

  // if there is no fork_id submitted, we backpedal 1 block to be safe
  if (fork_id == null || fork_id == "") { return 0; }
  if (fork_id.length < 2) { if (latest_known_block_id > 0) { latest_known_block_id - 1; } else { return 0; } }


  // roll back latest known block id to known fork ID measurement point
  for (var xmw = latest_known_block_id; xmw >= 0; xmw--) {
    if (xmw%this.fork_id_mod == 0) {
      latest_known_block_id = xmw;
      xmw = -1;
    }
  }

  // roll back until we have a match
  for (var fii = 0; fii < (fork_id.length/2); fii++) {

    var peer_fork_id_pair = fork_id.substring((2*fii),2);
    var our_fork_id_pair_blockid = latest_known_block_id;

    if (fii == 0)  { our_fork_id_pair_blockid = latest_known_block_id - 0; }
    if (fii == 1)  { our_fork_id_pair_blockid = latest_known_block_id - 10; }
    if (fii == 2)  { our_fork_id_pair_blockid = latest_known_block_id - 20; }
    if (fii == 3)  { our_fork_id_pair_blockid = latest_known_block_id - 30; }
    if (fii == 4)  { our_fork_id_pair_blockid = latest_known_block_id - 40; }
    if (fii == 5)  { our_fork_id_pair_blockid = latest_known_block_id - 50; }
    if (fii == 6)  { our_fork_id_pair_blockid = latest_known_block_id - 75; }
    if (fii == 7)  { our_fork_id_pair_blockid = latest_known_block_id - 100; }
    if (fii == 8)  { our_fork_id_pair_blockid = latest_known_block_id - 200; }
    if (fii == 9)  { our_fork_id_pair_blockid = latest_known_block_id - 500; }
    if (fii == 10) { our_fork_id_pair_blockid = latest_known_block_id - 1000; }
    if (fii == 11) { our_fork_id_pair_blockid = latest_known_block_id - 5000; }
    if (fii == 12) { our_fork_id_pair_blockid = latest_known_block_id - 10000; }
    if (fii == 13) { our_fork_id_pair_blockid = latest_known_block_id - 50000; }

    // return hash by blockid
    var tmpklr = this.returnHashByBlockIdLongestChain(our_fork_id_pair_blockid);

    // if we have not found a match, return 0 since we have 
    // irreconciliable forks, so we just give them everything
    // in the expectation that one of our forks will eventually
    // become the longest chain
    if (tmpklr == "") { return 0; }

    var our_fork_id_pair = tmpklr.substring(0, 2);

    // if we have a match in fork ID at a position, treat this
    // as the shared forkID
    if (our_fork_id_pair == peer_fork_id_pair) {
      return our_fork_id_pair_blockid;
    }

  }
  return 0;
}
Blockchain.prototype.updateForkId = function updateForkId(blk) {

  var blockid     = blk.returnId();
  var baseblockid = Math.floor(blockid / 10);
  var baseblockid = blockid;
  var fork_id     = "";
  var indexpos    = this.index.hash.length-1;

  for (var i = 0, stop = 0; stop == 0 && i < this.genesis_period;) {

    var checkpointblkid = baseblockid-i;
    var indexpos = this.returnLongestChainIndexPositionByBlockId(checkpointblkid, indexpos);

    if (indexpos == -1 || checkpointblkid < 0) { stop = 1; }
    else {
      // get the hash
      var th = this.index.hash[indexpos];
      fork_id += th.substring(0,2);
    }

    // if this is edited, we have to 
    // also change the function 
    //
    // - returnLastSharedBlockId
    //
    if (i == 10000) { i = 50000; }
    if (i == 5000)  { i = 10000; }
    if (i == 1000)  { i = 5000; }
    if (i == 500)   { i = 1000; }
    if (i == 200)   { i = 500; }
    if (i == 100)   { i = 200; }
    if (i == 75)    { i = 100; }
    if (i == 50)    { i = 75; }
    if (i == 40)    { i = 50; }
    if (i == 30)    { i = 40; }
    if (i == 20)    { i = 30; }
    if (i == 10)    { i = 20; }
    if (i == 0)     { i = 10; }

    if (i > this.genesis_period || i == 50000) { stop = 1; }

  }

  this.fork_id = fork_id;

}





Blockchain.prototype.purgeArchivedData = function purgeArchivedData(lowest_block_id) {

  var items_before_needed = 0;

  // find the number of items in our blockchain before
  // we run into the lowest_block_id. Remember that blocks
  // are going to be sequential so it is only forks that
  // we really worry about
  for (x = 0; x < this.index.block_id.length; x++) {
    if (this.index.block_id[x] < lowest_block_id) {
      items_before_needed++;
    }
    else { x = this.blocks.length; }
  }

console.log("\nPURGING lb_id: "+lowest_block_id);


  /////////////////////////////////////
  // delete from fast-access indexes //
  /////////////////////////////////////
  this.index.hash.splice(0, items_before_needed);
  this.index.ts.splice(0, items_before_needed);
  this.index.prevhash.splice(0, items_before_needed);
  this.index.burnfee.splice(0, items_before_needed);
  this.index.block_id.splice(0, items_before_needed);
  this.index.lc.splice(0, items_before_needed);


  ///////////////////////////////////
  // delete from blocks separately //
  ///////////////////////////////////
  //
  // right now we aren't removing blocks elsewhere, so 
  // just delete the block index in the same way
  //
  this.blocks.splice(0, items_before_needed);



  //////////////////
  // and clean up //
  //////////////////
  this.longestChain = this.longestChain - items_before_needed;
  this.app.storage.deleteBlocks(lowest_block_id);

  console.log("PURGED OUR DATA. OLDEST IS NOW: "+(lowest_block_id+1));

}








//////////////////////////////////////
// Inserting Blocks into Blockchain //
//////////////////////////////////////
//
// the add block function validates blocks, sticks them
// into our mempool, and starts a queue that processes
// them one-by-one into our blockchain. It receives a
// fully-formed block as its argument.
//
// the import block function does the same thing, but
// expects to be provided with a JSON object that contains
// the relevant block data. It recreates the block object
// and then does exactly the same.
//
Blockchain.prototype.addBlock = function addBlock(blk, relay_on_validate=1) {

  //////////////////////
  // check if indexed //
  //////////////////////
  if ( this.isHashIndexed( blk.hash('hex') ) == 1 ) {
    console.log("Hash is already indexed: " + blk.hash('hex') );
    return 0;
  }

  blockchain_self = this;



  ////////////////////
  // validate block //
  ////////////////////
  if (! blk.validate() ) {
    console.log("Block does not validate!!!");
    this.app.blockchain.mempool.removeBlock(blk);
console.log("INVALID BLOCK HASH: " + blk.hash('hex'));
console.log(JSON.stringify(blk.block, null, 4));
    return 0;
  }

  ////////////////////////////
  // validate golden ticket //
  ////////////////////////////
  if (! blk.validateGoldenTicket() ) {
    console.log("Block does not validate -- Golden Ticket Wrong!!!");
    this.app.blockchain.mempool.removeBlock(blk);
    return 0;
  }

  //////////////////////////////
  // validate monetary policy //
  //////////////////////////////
  blk.validateReclaimedFunds(function(validated_or_not) {

    if (validated_or_not == 0) {
      console.log("Reclaimed Funds found invalid");
      blockchain_self.app.blockchain.mempool.removeBlock(blk);
      return 0;
    }

    /////////
    // add //
    /////////
    if ( ! blockchain_self.mempool.addBlock(blk) ) { return 0; }

    ///////////////
    // propagate //
    ///////////////
    if (relay_on_validate == 1) {
      blockchain_self.app.network.propagateBlock(blk);
    }

    /////////////
    // process //
    /////////////
    blockchain_self.mempool.processBlocks();

  });

}
Blockchain.prototype.importBlock = function importBlock(blkjson, relay_on_validate=1) {
  var nb = new saito.block(this.app, blkjson);
  this.addBlock(nb, relay_on_validate);
}





///////////////////////
// Utility Functions //
///////////////////////
Blockchain.prototype.returnIndexPositionOfBlock = function returnIndexPositionOfBlock(blk) {
  var hash = blk.hash();
  for (var n = this.index.hash.length-1; n >= 0; n--) {
    if (this.index.hash[n] == hash) { 
      return n;
    }
  }
  return -1;
}

Blockchain.prototype.isHashIndexed = function isHashIndexed(hash) {

  if (this.blockbloom.test(hash, 'hex') == false) { 
    return -1;
  }

  for (var n = this.index.hash.length-1; n >= 0; n--) {
    if (this.index.hash[n] == hash) { 
      return 1; 
    }
  }

  return -1;
};
Blockchain.prototype.isBlockIdIndexed = function isBlockIdIndexed(block_id) {
  for (var n = this.index.block_id.length-1; n >= 0; n--) {
    if (this.index.block_id[n] == block_id) { 
      return 1; 
    }
    if (this.index.block_id[n] < block_id) {
      return -1;
    }
  }
  return -1;
};
Blockchain.prototype.returnHashByBlockIdLongestChain = function returnHashByBlockIdLongestChain(block_id) {
  for (var n = this.index.block_id.length-1; n >= 0; n--) {
    if (this.index.block_id[n] == block_id && this.index.lc[n] == 1) {
      return this.index.hash[n]; 
    }
    if (this.index.block_id[n] < block_id) {
      return "";
    }

    // faster than iterating through, but not optimized
    //
    if (n-50 >= 1) {
      if (this.index.block_id[n-50] > block_id) {
        n-=50;
      }
    }
  }
  return "";
};






// TODO
//
// should not search such a length period
//
// fix
//
Blockchain.prototype.returnUnixtime = function returnUnixtime(blockhash) {
  if (blockhash == "") { return -1; }
  for (var i = this.index.hash.length-1; i >= 0 && i > this.index.hash.length-1000; i--) {
    if (this.index.hash[i] == blockhash) {
        return this.index.ts[i];
    }
  }
  return -1;
}


Blockchain.prototype.returnLongestChain = function returnLongestChain(chainlength=10) {

  if (chainlength == 0) { return []; }

  var chainarray  = this.returnLongestChainIndex(chainlength);
  var reversearray = [];


  var finished = 0;
  for (var ii = chainarray.length-1; ii >= 0 && finished == 0; ii--) {

    var tmpblk = this.returnBlockByHash(this.index.hash[chainarray[ii]]);
    if (tmpblk != null) {
      reversearray.push(tmpblk);
    }
  }

  reversearray.reverse();

  return reversearray;

}
Blockchain.prototype.returnLongestChainIndex = function returnLongestChainIndex(chainlength=10) {
  if (this.index.hash.length == 0) { return []; }
  if (this.index.hash.length < chainlength) { chainlength = this.index.hash.length; }
  if (chainlength == 0) { return []; }

  var bchainIndex = [];
  var chain_pos = this.longestChain;

  bchainIndex.push(chain_pos);

  for (var z = 0; z < chainlength; z++) {

    var prev_pos = chain_pos-1;
    var prev_found = 0;

    if (prev_pos == -1) {
      z = chainlength+1;
    } else {

      // get the previous block
      while (prev_pos >= 0 && prev_found == 0) {
        if (this.index.hash[prev_pos] == this.index.prevhash[chain_pos]) {
          bchainIndex.push(prev_pos);
          prev_found = 1;
          chain_pos = prev_pos;
        } else {
          prev_pos--;
        }
      }
    }
  }
  return bchainIndex;
}
Blockchain.prototype.returnLongestChainIndexPositionByBlockId = function returnLongestChainIndexPositionByBlockId(blkid, spos=-1) {
  if (this.index.hash.length == 0) { return null; }
  var start_pos = this.index.hash.length-1;
  if (spos != -1) { start_pos = spos; }
  for (var c = start_pos; c >= 0; c--) {
    if (this.index.block_id[c] == blkid) {
      if (this.index.lc[c] == 1) {
	return c;
      }
    }
  }
  return -1;
}
Blockchain.prototype.returnBlockById = function returnBlockById(id=0) {
  if (this.index.hash.length == 0) { return null; }
  if (id == 0) { return null; }
  for (var bi = this.index.block_id.length-1; bi >= 0; bi--) {
    if (this.index.block_id[bi] == id && this.index.lc[bi] == 1) {
      return this.blocks[bi];
    }
  }
}
Blockchain.prototype.returnLatestBlock = function returnLatestBlock() {
  if (this.blocks.length == 0) { return null; }
  for (var i = this.blocks.length-1; i >= 0; i--) {
    if (this.blocks[i].hash() == this.index.hash[this.longestChain]) {
      return this.blocks[i];
    }
  }
  return null;
}
Blockchain.prototype.returnLatestBlockHash = function returnLatestBlockHash() {
  if (this.blocks.length == 0) { return ""; }
  if (this.blocks.length < this.longestChain) { return ""; }
  return this.index.hash[this.longestChain];
}
Blockchain.prototype.returnLatestBlockId = function returnLatestBlockId() {
  if (this.index.block_id.length == 0) { return 0; }
  return this.index.block_id[this.longestChain];
}
Blockchain.prototype.returnBlockByHash = function returnBlockByHash(hash) {
  if (this.blocks.length == 0) { return null; }
  for (var v = this.blocks.length-1; v >= 0; v-- ) {
    if (this.blocks[v].hash() == hash) {
      return this.blocks[v];
    }
  }
  return null;
}
Blockchain.prototype.returnForkId = function returnForkId() {
  return this.fork_id;
}
Blockchain.prototype.returnForkIdMod = function returnForkIdMod() {
  return this.fork_id_mod;
}
Blockchain.prototype.returnGenesisBlockId = function returnGenesisBlockId() {
  return this.genesis_block_id;
}
Blockchain.prototype.returnGenesisPeriod = function returnGenesisPeriod() {
  return this.genesis_period;
}
Blockchain.prototype.returnForkGuard = function returnForkGuard() {
  return this.fork_guard;
}
Blockchain.prototype.returnBlockchain = function returnBlockchain() {
  var x = {};
  x.latest_block_id  = this.returnLatestBlockId();
  x.genesis_block_id = this.returnGenesisBlockId();
  x.fork_id          = this.fork_id;
  return x;
}
Blockchain.prototype.returnBlockchainJson = function returnBlockchainJson() {
  return JSON.stringify(this.returnBlockchain());
}



Blockchain.prototype.resetBlockchain = function resetBlockchain() {

  if (this.index.block_id.length == 0) { return; }

  // remove all of our blocks in the index
  var newest_block_id = this.index.block_id[this.index.block_id.length-1];
  this.purgeArchivedData(newest_block_id);  
  this.app.network.fetchBlockchain("lite", 0);

}




// based on
// bcoin utils class
Blockchain.prototype.binaryInsert = function binaryInsert(list, item, compare, search) {
  var start = 0,
      end = list.length;

  while (start < end) {
    var pos = (start + end) >> 1;
    var cmp = compare(item, list[pos]);

    if (cmp === 0) {
      start = pos;
      end = pos;
      break;
    } else if (cmp < 0) {
      end = pos;
    } else {
      start = pos + 1;
    }
  }

  if (!search)
    list.splice(start, 0, item);
  return start;
}



