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
  this.genesis_period          = 10;        // number of blocks before money disappears
  //this.genesis_period          = 12160;     // number of blocks before money disappears
					    // 90,000 is roughly a 30 day transient blockchain.
  this.genesis_ts              = 0;         // unixtime of earliest block
  this.genesis_block_id        = 0;         // earlier block_id we care about
  this.fork_guard              = 5;       // discard forks that fall N blocks behind
  //this.fork_guard              = 120;       // discard forks that fall N blocks behind
  this.fork_id                 = "";        // a string we use to identify our longest-chain
  this.fork_id_mod             = 10;	    // update fork id every 10 blocks


  ////////////////////////////////
  // Validating Multiple Blocks //
  ////////////////////////////////
  this.validate_total       = 0;
  this.validate_current     = 0;


  /////////////
  // Indexes //
  /////////////
  //
  //    addBlockToBlockchain (add)
  //    purgeArchivedData (delete)
  //
  this.index = {
    hash:        [],                 // hashes
    prevhash:    [],                 // hash of previous block
    block_id:    [],                 // block id
    ts:          [],                 // timestamps
    lc:          [],                 // is longest chain (0 = no, 1 = yes)
    burnfee:     [],                 // burnfee per block
  };
  this.blocks         = [];
  this.block_hashmap  = [];
  this.lc_hashmap     = []; 	     // hashmap index is the  block hash and contains 
				     // 1 or 0 depending on if they are the longest 
				     // chain or not.
  this.longestChain   = -1;          // position of longest chain in indices


  ///////////////////////
  // avoiding problems //
  ///////////////////////
  this.currently_indexing = 0;
  this.reclaiming_funds = 0;
  this.ts_limit = -1;
  this.block_saving_timer = null;
  this.block_saving_timer_speed = 10;


  ///////////////
  // Callbacks //
  ///////////////
  this.callback_limit 	       = 100;        // only run callbacks on the last X blocks
  this.run_callbacks 	       = 1;	     // 0 for central nodes focused on scaling


  ////////////////
  // restarting //
  ////////////////
  this.previous_block_id = -1;
  this.previous_ts_limit = -1;
  this.previous_block_hash = "";

  return this;

}
module.exports = Blockchain;




//
// ADD BLOCK
//
// the add block function validates blocks, sticks them
// into our mempool, where they sit in a FIFO queue for 
// addition into the blockchain. 
//
Blockchain.prototype.addBlock = function addBlock(blk, relay_on_validate=1) {

  //////////////////////
  // check if indexed //
  //////////////////////
  if ( this.isHashIndexed( blk.returnHash() ) == 1 ) {
    console.log("Hash is already indexed: " + blk.returnHash() );
    return 0;
  }

  blockchain_self = this;


  ////////////////////
  // validate block //
  ////////////////////
  if (! blk.validate() ) {
    console.log("Block does not validate!!!");
    this.app.blockchain.mempool.removeBlock(blk);
    console.log("INVALID BLOCK HASH: " + blk.returnHash());
    blk.block.transactions = [];
    blk.transactions = [];
    console.log(JSON.stringify(blk.block, null, 4));
    process.exit();
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
  this.reclaiming_funds = 1;
  blk.validateReclaimedFunds(function(validated_or_not) {

    if (validated_or_not == 0) {
      console.log("Reclaimed Funds found invalid");
      blockchain_self.app.blockchain.mempool.removeBlock(blk);
      blockchain_self.reclaiming_funds = 0;
      return 0;
    }

    /////////
    // add //
    /////////
    if ( ! blockchain_self.mempool.addBlock(blk) ) { 
      blockchain_self.reclaiming_funds = 0;
      return 0; 
    }


    ///////////////
    // propagate //
    ///////////////
    if (relay_on_validate == 1) {
      blockchain_self.app.network.propagateBlock(blk);
    }

    /////////////
    // process //
    /////////////
    blockchain_self.reclaiming_funds = 0;
    blockchain_self.mempool.processBlocks();

  });

}




//
// addToBlockchain is where we take the actual block and stick
// it into our in-mempory blockchain (both the indexes and the
// queue of full-blocks.
//
// after inserting a block, this function also checks whether it
// forms the longest chain and updates our indexed array
//
// returns 1 when newblock should be deleted from mempool
//
Blockchain.prototype.addBlockToBlockchain = function addBlockToBlockchain(newblock, forceAdd="no") {

  if (newblock == null) {
    console.log("BLOCK IS NULL"); 
    return 0; 
  }
  if (this.currently_indexing == 1)   { 
    console.log("CURRENTLY INDEXING");
    return 0; 
  }
  if (this.reclaiming_funds == 1) {
    console.log("CURRENTLY RECLAIMING");
    return 0; 
  }
  if (this.mempool.clearing_mempool == 1) {
    console.log("CLEARING MEMPOOL");
    return 0;
  }
  if (this.mempool.creating_block == 1) {
    console.log("CREATING BLOCK IN MEMPOOL");
    return 0;
  }
  this.currently_indexing = 1;

  var hash           = newblock.returnHash('hex');
  var ts             = newblock.block.unixtime;
  var prevhash       = newblock.block.prevhash;
  var block_id       = newblock.block.id;
  var existing_longestChain = this.longestChain;

  var startTime = new Date().getTime();
  console.log("\n\n\nSTART TIME: "+startTime);
  console.log("Adding block "+block_id + " -> " + hash + " " + newblock.block.unixtime);

  // if the timestamp for this block is BEFORE our genesis block, we
  // refuse to process it out of principle. Our sorting algorithm will
  // still accept orphan chains that post-date our genesis block, but
  // will not try to find blocks with timestamps earlier than our
  // genesis block.
  //
  // this prevents us trying to load blocks endlessly into the past as
  // we find references to previous block hashes that we do not have
  // indexed.
  //
  if (ts < this.genesis_ts) {
    if (forceAdd != "force") {
      this.currently_indexing = 0;
      return 1;
    }
  }
  if (this.isHashIndexed(hash) == 1) {
    this.currently_indexing = 0;
    return 1;
  }


  ////////////////////
  // missing blocks //
  ////////////////////
  //
  // if we are adding our first block, we set this as 
  // the ts_limit to avoid requesting missing blocks
  // ad infinitum into the past.
  //
  if (this.ts_limit == -1) {
    if (this.app.options.blockchain != null) {
      this.ts_limit = this.previous_ts_limit;
    }
    if (this.ts_limit == -1) {
      this.ts_limit = newblock.block.unixtime;
    }
  } else {
    if (this.ts_limit > newblock.block.unixtime && forceAdd != "no") {
      this.ts_limit = newblock.block.unixtime;
    }
  }

  //
  // if our previous block hash was not indexed we request the missing 
  // block unless its timestamp is going to precede our first block
  // and genesis block, in which case we don't need it.
  //
  if (prevhash != "") {
    if (this.ts_limit <= newblock.block.unixtime) {
      if (this.isHashIndexed(prevhash) == -1) {
        var response       = {};
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
  var pos = this.binaryInsert(this.index.ts, ts, function(a,b) { return a -b;});
  this.index.hash.splice(pos, 0, hash);
  this.index.prevhash.splice(pos, 0, prevhash);
  this.index.block_id.splice(pos, 0, block_id);
  this.index.lc.splice(pos, 0, 0);              // set longest chain to 0 until we know it is longest chain
  this.index.burnfee.splice(pos, 0, newblock.returnBurnFee());
  this.block_hashmap[hash] = block_id;
  this.blocks.splice(pos, 0, newblock);



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
  

  ///////////////////////////
  // calculate average fee //
  ///////////////////////////
  newblock.returnAverageFee();


  /////////////////////
  // affix callbacks //
  /////////////////////
  this.blocks[pos].affixCallbacks();
  


  /////////////////////////////
  // track the longest chain //
  /////////////////////////////
  var i_am_the_longest_chain = 0;
  var shared_ancestor_index_pos = -1;
  var validate_transactions = -1;


  // possibly adjust longestChain forward
  // to accommodate newly inserted block
  if (pos <= this.longestChain) {
    this.longestChain++;
    if (this.longestChain >= this.index.hash.length) {
      this.longestChain--;
    }
  }


  // if genesis block, set as longest chain
  if (prevhash == "" && this.index.prevhash.length == 1) {
    this.longestChain = 0;
    i_am_the_longest_chain = 1;
  }



  // first block
  if (this.previous_block_id != null) {
    if (this.index.hash.length == 1 && this.previous_block_id == newblock.returnId()-1) {
      this.longestChain = 0;
      i_am_the_longest_chain = 1;
    }
  }




  if (block_id >= this.index.block_id[this.longestChain]) {
    if (prevhash == this.index.hash[this.longestChain] || prevhash == this.app.options.blockchain.latest_block_hash) {

      // if prev is longest, so is this
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

      var ancestor_precedes_current = 0;

      if (nchain_ts >= lchain_ts) {
        search_pos = nchain_pos-1;
      } else {
        ancestor_precedes_current = 1;
        search_pos = lchain_pos-1;
      }

      while (search_pos >= 0) {

        search_ts    = this.index.ts[search_pos];
        search_hash  = this.index.hash[search_pos];
        search_ph    = this.index.prevhash[search_pos];
        search_brn   = this.index.burnfee[search_pos];

        if (search_hash == lchain_ph && search_hash == nchain_ph) {
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
	  shared_ancestor_index_pos = search_pos;
          search_pos--;
        }
      }



      if (nchain_len > lchain_len && nchain_brn >= lchain_brn) {

        // in order to prevent our system from being gamed, we
        // require the attacking chain to have equivalent
        // or greater aggregate burn fees. This ensures that
        // an attacker cannot lower difficulty, pump out a
        // ton of blocks, and then hike the difficulty only
        // at the last moment.
      
        console.log("UPDATING LONGEST CHAIN: "+nchain_len + " new |||||| " + lchain_len + " old 1");
        i_am_the_longest_chain = 1;
        this.reorganizeLongestChain(newblock, shared_ancestor_index_pos, nchain_len, lchain_len, forceAdd);
        validate_transactions = nchain_len;
        this.longestChain = pos;
        this.app.modules.updateBalance();

      } else {

        // we can support a preferred chain that matches our preferences
        if (nchain_len == lchain_len && nchain_brn >= lchain_brn) {

          latestBlock = this.returnLatestBlock();
          if (latestBlock != null) {

            if (this.voter.prefers(newblock, latestBlock)) {

              console.log("UPDATING LONGEST CHAIN W/ PREFERENCE: "+nchain_len + " new |||||| " + lchain_len + " old 2");
              i_am_the_longest_chain = 1;
              this.reorganizeLongestChain(newblock, shared_ancestor_index_pos, nchain_len, lchain_len, forceAdd);
              validate_transactions = nchain_len;
              this.longestChain = pos;
              this.app.modules.updateBalance();
            }
          }
        }
      }
    }
  } else {

    // if this is the first block but we received another previously, reset this to 
    // the first block and let the network figure it out. We also set our previous
    // block has to this one.
    if (newblock.block.prevhash == this.previous_block_hash) {

      // reset later blocks to non-longest chain
      for (var h = pos+1; h < this.index.lc.length; h++) {
        this.index.lc[h] = 0;
        this.app.storage.saveLongestChainStatus(this.index.hash[h], this.index.block_id[h], 0);
        this.app.wallet.handleChainReorganization(this.index.block_id[h], this.index.hash[h], 0);
        this.app.modules.onChainReorganization(this.index.block_id[h], this.index.hash[h], 0);
      }

      // now insist that I am the longest chain
      i_am_the_longest_chain = 1;
      this.previous_block_hash = hash;
      this.longestChain = pos;
      this.app.modules.updateBalance();     

    }

  }



  ////////////////////
  // back to normal //
  ////////////////////
  if (i_am_the_longest_chain == 1) {

    this.index.lc[pos] = 1;
    this.miner.stopMining();
    this.miner.startMining(newblock);

    this.app.options.blockchain = this.returnBlockchain();
    this.app.storage.saveOptions();

  }


  var blockchain_self = this;

  var tmpgt = new Date().getTime();
  console.log(" ... saving block1:    " + tmpgt);

  // write latest block data to long-term storage
  // if we don't already have it in our database
  this.app.storage.saveBlock(newblock, i_am_the_longest_chain);


  var tmpgt = new Date().getTime();
  console.log(" ... saving block2:    " + tmpgt);

  //////////////
  // HASH MAP //
  //////////////
  blockchain_self.lc_hashmap[hash] = i_am_the_longest_chain;



//console.log(" ... payment confirmation");


  /////////////////////////////////////////////////////
  // tell our wallet about any money intended for us //
  /////////////////////////////////////////////////////
  var tmpgt2 = new Date().getTime();
  console.log(" ... updating wallet1: " + tmpgt2);

  var updated_wallet = 0;
  blockchain_self.app.wallet.purgeExpiredSlips();
  if (forceAdd != "force") {
    for (var ti = 0; ti < newblock.transactions.length; ti++) {
      var tx = newblock.transactions[ti];
      if (tx.isFrom(blockchain_self.app.wallet.returnPublicKey()) || tx.isTo(blockchain_self.app.wallet.returnPublicKey())) {
        updated_wallet = 1;
        blockchain_self.app.wallet.paymentConfirmation(newblock, tx, i_am_the_longest_chain);
      }
    }
    if (updated_wallet == 1) {
      if (i_am_the_longest_chain == 1) {
        blockchain_self.app.wallet.calculateBalance();
        blockchain_self.app.wallet.updateBalance();
      }
      blockchain_self.app.wallet.saveWallet();
      blockchain_self.app.storage.saveOptions();
    }
    blockchain_self.app.wallet.resetSpentInputs();
  }


//console.log(" ... longest chain? "+i_am_the_longest_chain);
//console.log(" ... run callbacks");
//console.log(" ... position? " + pos);

  var tmpgt3 = new Date().getTime();
  console.log(" ... updating wallet2: " + tmpgt3);

  /////////////////////////////////////////////
  // now run the callbacks for longest chain //
  /////////////////////////////////////////////
  if (blockchain_self.run_callbacks == 1) {
  if (forceAdd != "force") {
    var our_longest_chain = blockchain_self.returnLongestChainIndex(blockchain_self.callback_limit);
    for (var i = 0; i < our_longest_chain.length && i < blockchain_self.callback_limit; i++) {
      var thisblk = this.returnBlockByHash(this.index.hash[our_longest_chain[i]]);
      if (thisblk != null) {
        thisblk.runCallbacks(i);
        blockchain_self.app.storage.saveConfirmation(thisblk.returnHash(), i);
      } else {
	// error finding block ?
      }
    }
  } else {
    // we are forcing blocks in without callbacks, but we still 
    // update their confirmation numbers.
    var our_longest_chain = blockchain_self.returnLongestChainIndex(blockchain_self.callback_limit);

    for (var i = 0; i < our_longest_chain.length; i++) {
      var thisblk = blockchain_self.returnBlockByHash(blockchain_self.index.hash[our_longest_chain[i]]);
      thisblk.updateConfirmationNumberWithoutCallbacks(i);
    }
  }
  }

//console.log(" ... delete transactions from memory");


  /////////////////////////////////////
  // delete transactions from memory //
  /////////////////////////////////////
  //
  // this is a temporary optimization -- in the case of a chain 
  // reorganization we may need full access to transactions again
  // in order to run callbacks on those > 100 deep in the chain
  // but for now we just delete the full transaction data from 
  // anything deeper in the stack than our callback limit.
  //
  // note that block propagation to lite nodes fails if the callback
  // limit is too short and we don't have the block data actively
  // stored in memory.
  // 
  if (blockchain_self.blocks.length > blockchain_self.callback_limit) {
    var blk2clear = blockchain_self.blocks.length - blockchain_self.callback_limit-1;
    if (blk2clear >= 0) {
      blockchain_self.blocks[blk2clear].transactions = [];
      blockchain_self.blocks[blk2clear].block.transactions = [];
      // sanity check for blocks added earlier
      if (pos < blk2clear) {
        blockchain_self.blocks[pos].transactions = [];
        blockchain_self.blocks[pos].block.transactions = [];
      }
    }
  }

//console.log(" ... update fork and genesis");

  ////////////////////
  // update fork id //
  ////////////////////
  if (newblock.returnId()%blockchain_self.fork_id_mod == 0) { blockchain_self.updateForkId(newblock); }


  //////////////////////////
  // update genesis block //
  //////////////////////////
  if (newblock.returnId() >= (blockchain_self.genesis_block_id+blockchain_self.genesis_period+blockchain_self.fork_guard)) {
console.log(" ... UPDATING GENESIS BLOCK: " + pos);
    pos = blockchain_self.updateGenesisBlock(newblock, pos);
//console.log("UPDATING GENESIS BLOCK: " + pos);
  }




  ///////////////////////////
  // update wallet balance //
  ///////////////////////////
  blockchain_self.app.wallet.updateBalance();




  //////////////////////////////////////////////////////////
  // make sure we have saved everything before continuing //
  //////////////////////////////////////////////////////////
  var blockchain_self = this;

  var tmpgt5 = new Date().getTime();
  console.log(" ... hitting timer1:   " + tmpgt5);


  if (blockchain_self.app.storage.saving_blocks == 1 || blockchain_self.app.storage.saving_slips == 1 || blockchain_self.app.storage.spending_slips == 1) {
    console.log("NOT DONE SAVING: " + blockchain_self.app.storage.saving_blocks + " " + blockchain_self.app.storage.saving_slips + " " + blockchain_self.app.storage.spending_slips);
    blockchain_self.block_saving_timer = setInterval(function() {
      blockchain_self.addBlockToBlockchainPartTwo(newblock, pos, validate_transactions, hash, existing_longestChain, forceAdd);
    }, this.block_saving_timer_speed);
  } else {
    blockchain_self.addBlockToBlockchainPartTwo(newblock, pos, validate_transactions, hash, existing_longestChain, forceAdd);
  }


  // delete from mempool
  return 1;

}
Blockchain.prototype.addBlockToBlockchainPartTwo = function addBlockToBlockchainPartTwo(newblock, pos, validate_transactions, hash, existing_longestChain, forceAdd) {

      var blockchain_self = this;

      var tmpDateTimew = new Date().getTime();
      console.log(" ... and block saved:  " + tmpDateTimew); 
      clearInterval(blockchain_self.block_saving_timer);



      // now that save is complete we can delete the 
      // JSON copies of the transactions from our 
      // local memory.
      //
      // this is a minor optimization, since there
      // is no need to store the block in active 
      // memory AND store the JSON txs
      blockchain_self.blocks[pos].block.transactions = [];


      var intTime = new Date().getTime();
      console.log(" ... time: "+intTime);


      /////////////////////////////////
      // validate block transactions //
      /////////////////////////////////
      if (validate_transactions == -1 || newblock.transactions.length == 0 || forceAdd == "force") {

        blockchain_self.currently_indexing = 0;
        blockchain_self.validate_total = 0;
        blockchain_self.validate_current = 0;

	blockchain_self.addBlockToBlockchainSuccess(blockchain_self.app, null, newblock, forceAdd);

      } else {

        // validating transactions
        blockchain_self.validate_total          = newblock.transactions.length;
        blockchain_self.validate_current        = 0;

        if (blockchain_self.app.BROWSER == 1 || blockchain_self.app.SPVMODE == 1) {
          blockchain_self.validate_current = newblock.transactions.length-1;
          blockchain_self.addBlockToBlockchainSuccess(blockchain_self.app, null, newblock, forceAdd);
        } else {
console.log(" ... and validating inputs");
          blockchain_self.app.storage.validateBlockInputs(newblock, existing_longestChain, 2, validate_transactions, forceAdd);
        }
      }

      //////////////////////////////////
      // allow further block bundling //
      //////////////////////////////////
      blockchain_self.mempool.removeGoldenTicket();

}
Blockchain.prototype.addBlockToBlockchainSuccess = function addBlockToBlockchainSuccess(app, tx, blk, forceAdd) {

  console.log(" ... and inputs validated");

  var stopTime = new Date().getTime();
  console.log("STOP TIME: "+stopTime+ "\n\n");

  /////////////////////
  // module callback //
  /////////////////////
  if (forceAdd != "force") { app.modules.onNewBlock(blk); }

  app.blockchain.mempool.processing_bundle = 0;
  app.blockchain.currently_indexing = 0;

}
Blockchain.prototype.addBlockToBlockchainFailure = function addBlockToBlockchainFailure(blk, tx, old_lc, lchain_len) {

  console.log("\n\nBAD TRANSACTION results in BLOCK PURGE\n\n");
console.log(blk.block);
  console.log("BK HS: "+blk.hash('hex'));
  console.log("BK ID: "+blk.block.id);
  if (tx != null) {
    console.log("TX ID: "+tx.returnId());
  }
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
  blk.app.blockchain.mempool.processing_bundle = 0;

console.log("values reset....");

}


//
// BINARY INSERT
//
// utility function used to add items to our fast indexes
//
Blockchain.prototype.binaryInsert = function binaryInsert(list, item, compare, search) {

  var start = 0;
  var end = list.length;

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

  if (!search) {
    list.splice(start, 0, item);
  }

  return start;
}

// IMPORT BLOCK
//
// the import block function expects to be provided with
// a JSON object that can be imported. It recreates the 
// block object and then submits it to addBlock()
Blockchain.prototype.importBlock = function importBlock(blkjson, relay_on_validate=1) {
  var nb = new saito.block(this.app, blkjson);
  this.addBlock(nb, relay_on_validate);
}

// INITIALIZE
//
// initializes us with reference information to the previous blocks
// in the chain, etc. based on the information contained in our
// options configuration file.
//
Blockchain.prototype.initialize = function initialize() {
  this.app.storage.indexRecentBlocks(this.genesis_period+this.fork_guard);
  this.previous_block_id = this.app.options.blockchain.latest_block_id;
  this.previous_ts_limit = this.app.options.blockchain.latest_block_ts;
  this.previous_block_hash = this.app.options.blockchain.latest_block_hash;
}
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
Blockchain.prototype.isHashIndexed = function isHashIndexed(hash) {
  if (this.block_hashmap[hash] > 0) { return 1; }
  return -1; 
};
Blockchain.prototype.purgeArchivedData = function purgeArchivedData(lowest_block_id, pos) {

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



  // WE NEED TO REMOVE THE ZIP FILE ON DISK
  //
  // AND REMOVE THE SLIPS FROM THE HASHMAP
  //
  // TO AVOID PROBLEMS
  //////////////////////////////
  // delete transaction slips //
  //////////////////////////////
  for (var b = 0; b < items_before_needed; b++) {
    this.app.storage.purgeBlockStorage(this.index.hash[b]);
  }






  /////////////////////////
  // delete from hashmap //
  /////////////////////////
  for (var x = 0; x < items_before_needed; x++) {
    var bh = this.index.hash[x];
    delete this.block_hashmap[bh];
    delete this.lc_hashmap[bh];
  }


  ////////////////////////////////////////////////
  // delete from fast-access indexes and blocks //
  ////////////////////////////////////////////////
  this.index.hash.splice(0, items_before_needed);
  this.index.ts.splice(0, items_before_needed);
  this.index.prevhash.splice(0, items_before_needed);
  this.index.burnfee.splice(0, items_before_needed);
  this.index.block_id.splice(0, items_before_needed);
  this.index.lc.splice(0, items_before_needed);
  this.blocks.splice(0, items_before_needed);


  var newpos = pos - items_before_needed; 


  //////////////////
  // and clean up //
  //////////////////
  this.longestChain = this.longestChain - items_before_needed;
  //
  // we handle this in deleteZip above
  //
  //this.app.storage.deleteBlocks(lowest_block_id);



  ////////////////////////////
  // and delete from wallet //
  ////////////////////////////
  this.app.wallet.purgeExpiredSlips();

  return newpos;

}
Blockchain.prototype.resetMiner = function resetMiner() {
  var latestBlk = this.returnLatestBlock();
  this.miner.stopMining();
  if (latestBlk != null) { this.miner.startMining(latestBlk); }
}
Blockchain.prototype.resetBlockchain = function resetBlockchain() {

  if (this.index.block_id.length == 0) { return; }

  // remove all of our blocks in the index
  var newest_block_id = this.index.block_id[this.index.block_id.length-1];
  this.purgeArchivedData(newest_block_id);  
  this.app.network.fetchBlockchain("lite", 0);

}
Blockchain.prototype.returnIndexPositionOfBlock = function returnIndexPositionOfBlock(blk) {
  var hash = blk.returnHash();
  for (var n = this.index.hash.length-1; n >= 0; n--) {
    if (this.index.hash[n] == hash) { 
      return n;
    }
  }
  return -1;
}
Blockchain.prototype.returnLastSharedBlockId = function returnLastSharedBlockId(fork_id, latest_known_block_id) {

  // if there is no fork_id submitted, we backpedal 1 block to be safe
  if (fork_id == null || fork_id == "") { return 0; }
  if (fork_id.length < 2) { if (latest_known_block_id > 0) { latest_known_block_id - 1; } else { return 0; } }


  // roll back latest known block id to known fork ID measurement point
  for (var x = latest_known_block_id; x >= 0; x--) {
    if (x%this.fork_id_mod == 0) {
      latest_known_block_id = x;
      x = -1;
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
// fix -- check ID from hashmap and search for block that way
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
    if (this.blocks[i].hash == this.index.hash[this.longestChain]) {
      return this.blocks[i];
    }
  }
  return null;
}
Blockchain.prototype.returnLatestBlockUnixtime = function returnLatestBlockUnixtime() {
  if (this.blocks.length == 0) { return -1; }
  if (this.blocks.length < this.longestChain) { return -1; }
  return this.index.ts[this.longestChain];
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
    if (this.blocks[v].hash == hash) {
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
  x.latest_block_ts    = this.returnLatestBlockUnixtime();
  x.latest_block_hash  = this.returnLatestBlockHash();
  x.latest_block_id    = this.returnLatestBlockId();
  x.genesis_block_id   = this.returnGenesisBlockId();
  x.fork_id            = this.fork_id;
  return x;
}
Blockchain.prototype.returnBlockchainJson = function returnBlockchainJson() {
  return JSON.stringify(this.returnBlockchain());
}









// REORGANIZE LONGEST CHAIN
//
// This updates our storage class and wallet data with information 
// about a new longest chain. Whenever a non-blockchain class needs
// to be notified about changes to the longest chain, we put it here.
// 
Blockchain.prototype.reorganizeLongestChain = function reorganizeLongestChain(newblock, shared_ancestor_index_pos, nchain_len, lchain_len, forceAdd) {

  if (newblock.block.prevhash == "") { return; }
  if (shared_ancestor_index_pos > -1) {

    // reset to non-longest chain
    for (var h = shared_ancestor_index_pos+1; h < this.index.lc.length; h++) {
      this.index.lc[h] = 0;
      this.app.storage.saveLongestChainStatus(this.index.hash[h], this.index.block_id[h], 0);
      this.app.wallet.handleChainReorganization(this.index.block_id[h], this.index.hash[h], 0);
      this.app.modules.onChainReorganization(this.index.block_id[h], this.index.hash[h], 0);
    }

    var shared_ancestor_hash = this.index.hash[shared_ancestor_index_pos];
    var hash_to_hunt_for = newblock.returnHash('hex');
    var new_block_hashes = [];

    for (var j = this.index.hash.length-1; j >= shared_ancestor_index_pos; j--) {
      if (this.index.hash[j] == hash_to_hunt_for) {
        this.index.lc[j] = 1;
        hash_to_hunt_for = this.index.prevhash[j];
        this.app.storage.saveLongestChainStatus(this.index.hash[j], this.index.block_id[j], 1);
        this.app.wallet.handleChainReorganization(this.index.block_id[j], this.index.hash[j], 1);
        this.app.modules.onChainReorganization(this.index.block_id[j], this.index.hash[j], 1);
        new_block_hashes.push(this.index.hash[j]);
      }
    }
  }
}
// REWRITE LONGEST CHAIN INDEX
//
// this is ugly code that is used by the Storage class when 
// a block fails to validate and we need to re-write the 
// longest-Chain indexes to restore us back to the block 
// before we accepted the failed chain.
//
Blockchain.prototype.rewriteLongestChainIndex = function rewriteLongestChainIndex(shared_ancestor_index_pos, correct_pos_array) {

  for (var h = shared_ancestor_index_pos+1; h < this.index.lc.length; h++) {
    this.index.lc[h] = 0;
    this.app.storage.saveLongestChainStatus(this.index.hash[h], this.index.block_id[h], 0);
  }

  for (var z = 0; z < correct_pos_array.length; z++) {
    this.index.lc[correct_pos_array[z]] = 1;
    this.app.storage.saveLongestChainStatus(this.index.hash[correct_pos_array[z]], this.index.block_id[correct_pos_array[z]], 1);
  }

}



Blockchain.prototype.updateForkId = function updateForkId(blk) {

  // chain reorgs + vacuuming can cause problems where
  // a bad block will result in an updateForkId request
  // on a block that is null. this is a temporary workaround
  if (blk == null) { return this.fork_id; }

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
// UPDATE GENESIS BLOCK
//
// when the blockchain hits a certain length we throw out all of our older blks
// this is possible because block ids are incremental. We do check our last fork_guard
// blocks to make sure there is not a block that might reference one of the
// blocks we are throwing out before we purge ourselves of this effort.
//
Blockchain.prototype.updateGenesisBlock = function updateGenesisBlock(blk, pos) {

  // we need to make sure this is not a random block that is disconnected
  // from our previous genesis_id. If there is no connection between it
  // and us, then we cannot delete anything as otherwise the provision of
  // the block may be an attack on us intended to force us to discard
  // actually useful data.
  //
  // we do this by checking that our block is the head of the
  // verified longest chain.
  //
  if (this.index.hash[this.longestChain] != blk.returnHash('hex')) {
    return pos;
  }
  if (this.index.hash.length < this.genesis_period) {
    return pos;
  }


  if (blk.returnId() >= (this.genesis_block_id + this.genesis_period + this.fork_guard)) {

    // check the fork guard period to see if there is a viable
    // competing chain. If there is we must assume there may be
    // a viable competing chain to preserve
    var is_there_a_challenger = 0;
    var our_block_id    = blk.returnId();

    // -1 accounts for the fact we reclaim the funds from unspent
    // golden tickets, and need to know for sure that those slips
    // have not been spent when we calculate getting them back
    // into circulation. So we keep an extra block on the tail 
    // end, even if it is unspendable, for validation
    var lowest_block_id = our_block_id - this.genesis_period - 1;

    // do not delete if our new genesis block would be less than zero
    if (lowest_block_id <= 0) { return; }

    // otherwise, figure out what the lowest block ID is that would 
    // be possible to grow into a viable fork. We do this by looking 
    // at our recently produced blocks. The fork guard here is an 
    // arbitrary constant.
    for (var c = 2; c <= this.fork_guard && c < this.index.block_id.length; c++) {
      if (this.index.block_id[this.index.block_id.length-c] < lowest_block_id) {
        lowest_block_id = this.index.block_id[this.index.block_id.length-2];
      }
    }

    // this is needed before update genesis_block_id to ensure
    //  wallet slips are updated properly (they are updated in 
    // purgeArchivedData but require a new genesis_period to 
    // calculate, so much udpate genesis_period and THEN purge,
    // meaning this calculation must be stored
    var purge_id = lowest_block_id - this.genesis_period;

    // finally, update our genesis block_id to the current_block minus
    // the genesis period. We will run this function again when the
    // fork guard has passed, and if any forks have not sufficiently
    // kept pace in that time, they will be discarded them.
    this.genesis_block_id = blk.returnId() - this.genesis_period;


    // in either case, we are OK to throw out everything below the
    // lowest_block_id that we have found, since even the lowest
    // fork in our guard_period will not need to access transactions
    // from before itself and the genesis period.
    //
    // we use the purge_id variable since our functions inside
    // need to delete from wallet slips, which requires genesis
    // block_id to be set properly. 
    return this.purgeArchivedData(purge_id, pos);

  }

  return pos;
}



