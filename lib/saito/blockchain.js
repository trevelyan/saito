var saito   = require('../saito');
var t       = require('../start');
var utils   = t.utils;




function Blockchain(app) {

  if (!(this instanceof Blockchain)) { return new Blockchain(app); }

  this.app     = app || {};

  this.mempool = new saito.mempool(this.app);
  this.miner   = new saito.miner(this.app);
  this.voter   = new saito.voter(this.app);


  /////////////////////////
  // Consensus Variables //
  /////////////////////////
  this.heartbeat               =  20;       // expect new block every 20 seconds
  this.money_supply            = 21000000;  // zero-inflation target
  this.genesis_period          = 10000;     // adjust the genesis hash each N blocks
  this.genesis_ts              = 0;         // unixtime of earliest block
  this.genesis_block_id        = 0;         // earlier block_id we care about
  this.fork_guard              = 5;         // discard forks that fall N blocks behind
  this.fork_id                 = "";        // a string we use to identify our longest-chain

  ///////////////////
  // Longest Chain //
  ///////////////////
  this.longestChain            = -1; // position of longest chain in indices


  ////////////
  // Blocks //
  ////////////
  this.blocks                  = [];


  /////////////
  // Indexes //
  /////////////
  //
  // when adding an index, be sure to edit
  //
  //    indexAndStore (which adds it)
  //    purgeArchivedData (which deletes it)
  this.index = {
    hash:     [],                       // hashes
    prevhash: [],                       // hash of previous block
    block_id: [],                       // block id
    ts:       [],                       // timestamps
    lc:       [],                       // is longest chain (0 = no, 1 = yes)
  };



  ///////////////////////
  // avoiding problems //
  ///////////////////////
  this.currently_indexing = 0;

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
  //this.app.storage.indexRecentBlocks(this.genesis_period+this.fork_guard);
  this.app.storage.indexRecentBlocks(40);

}





///////////
// Debug // -- print out the longest chain
///////////
Blockchain.prototype.debug = function debug() {

  for (mb = 0; mb < this.blocks.length; mb++) {
    longestchainhash = this.index.hash[this.longestChain];
    if (longestchainhash == this.blocks[mb].hash()) {
      console.log("***** " + this.blocks[mb].block.id + " (" + this.blocks[mb].block.unixtime + ") -- " + this.blocks[mb].hash() + "  ----->  " + this.blocks[mb].block.prevhash);
    } else {
      console.log(this.blocks[mb].block.id + " (" + this.blocks[mb].block.unixtime + ") -- " + this.blocks[mb].hash() + "  ----->  " + this.blocks[mb].block.prevhash);
    }
  }

  console.log("\n\n\n ... and now the indexes ...")
  for (i = 0; i < this.index.hash.length; i++) {
    console.log(this.index.lc[i] + " ("+this.index.ts[i] +") ----> " + this.index.block_id[i] + " || " + this.index.hash[i] + " || " + this.index.prevhash[i]);


  }

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
// forms the longest chain.
//
Blockchain.prototype.liteBlockIndexAndStore = function liteBlockIndexAndStore(newblock, forceAdd="no") {

  if (this.currently_indexing == 1) { return 0; }
  this.currently_indexing = 1;


}
Blockchain.prototype.indexAndStore = function indexAndStore(newblock, forceAdd="no") {


  if (this.currently_indexing == 1) { return 0; }
  this.currently_indexing = 1;


  console.log("Adding block "+newblock.hash() + " " + newblock.block.unixtime);

  var hash           = newblock.hash('hex');
  var ts             = newblock.block.unixtime;
  var prevhash       = newblock.block.prevhash;
  var block_id       = newblock.block.id;


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
      return;
    }
  }


  // 
  // extremely naive algorithm that needs to be replaced with a 
  // bloom filter so that we don't need to check our entire 
  // index every time we are adding a block to our blockchain
  //
  //
  if (this.isHashIndexed(hash) == 1) {
    //console.log("Block Hash: "+hash+" matches hash in transaction history...");
    this.currently_indexing = 0;
    return;
  }



  // if our previous block hash was not indexed and our timestamp
  // is greater than the current genesis block, then we sent a
  // request out into the network to ask for it.
  if (prevhash != "") {
    if (this.isHashIndexed(prevhash) == -1) {
      response           = {};
      response.request   = "missing block";
      response.data      = {};
      response.data.hash = prevhash;
      this.app.network.sendRequest(response.request, JSON.stringify(response.data));
    }
  }



  ////////////////////
  // insert indexes //
  ////////////////////
  var pos = utils.binaryInsert(this.index.ts, ts, compareTs);
  this.index.hash.splice(pos, 0, hash);
  this.index.prevhash.splice(pos, 0, prevhash);
  this.index.block_id.splice(pos, 0, block_id);
  this.index.lc.splice(pos, 0, 0);              // set longest chain to 0 until we know it is longest chain

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
 



  //////////////////////////////////////////////////////////
  // if this is our first block, it is longest by default //
  //////////////////////////////////////////////////////////
  if (this.longestChain == -1) { this.longestChain = 0; }





  ///////////////////////////////////////////
  // tell our block to affix its callbacks //
  ///////////////////////////////////////////
  this.blocks[blkpos].affixCallbacks();
  




  /////////////////////////////////////////////////////
  // tell our wallet about any money intended for us //
  /////////////////////////////////////////////////////
  for (ti = 0; ti < newblock.transactions.length; ti++) {
    tx = newblock.transactions[ti];
    if (tx.isFrom(this.app.wallet.returnPublicKey()) || tx.isTo(this.app.wallet.returnPublicKey())) {
      this.app.wallet.paymentConfirmation(newblock, tx);
    }
  }





  /////////////////////////////
  // track the longest chain //
  /////////////////////////////
  var i_am_the_longest_chain = 0;
  var shared_ancestor_index_pos = -1;

  // if we inserted our item earlier than our existing longest item, then we need
  // to adjust our longestChain variable forward by one so that the current
  // longestChain item is still the longestChain item
  if (pos <= this.longestChain) {
    this.longestChain++;
    if (this.longestChain >= this.index.hash.length) {
      this.longestChain--;
    }
  }



  // if this is our genesis block, we set it as our longest chain
  if (prevhash == "" && this.index.prevhash.length == 1) {
    this.longestChain == 0;
    i_am_the_longest_chain = 1;
  }

  // update the longestChain
  if (prevhash == this.index.hash[this.longestChain]) {

    // if our previous hash is the last block, then this is the
    // longest chain by default
    this.longestChain = pos;
    i_am_the_longest_chain = 1;

  } else {

    // we do not update the longest chain if the starting BURN FEE
    // is LOWER on the new block than our current longest chain
    //
    //

    latestBlock        = this.returnLatestBlock();
    latestBlockBurnFee = -1;

    if (latestBlock != null) {
      latestBlockBurnFee = latestBlock.returnBurnFee();
    }


    // if this is our first block, we will automatically
    // go to the ELSE clause as our latestBlockBurnFee will be -1
    if (latestBlockBurnFee > newblock.returnBurnFee()) {

      i_am_the_longest_chain = 0;

      //
      //
      // does this make sense as a first stab at the problem?
      //
      //
      // yes... put here it prevents the network from ever adjusting
      // the difficult down... but we can put up with this as 
      // a temporary solution to the problem of stealth attacks 
      // motivated by a desire to manipulate the difficulty down
      // upgrade the network later.

    } else {

      // otherwise, we need to find the last shared ancestor and
      // calculate the length of the two competing blocks to determine
      // which is longest

      lchain_pos = this.longestChain;
      nchain_pos = pos;
      lchain_len = 0;
      nchain_len = 0;

      lchain_ts  = this.index.ts[lchain_pos];
      nchain_ts  = this.index.ts[nchain_pos];
      lchain_ph  = this.index.prevhash[lchain_pos];
      nchain_ph  = this.index.prevhash[nchain_pos];



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


        if (search_hash == lchain_ph && search_hash == nchain_ph) {
          console.log("Prev NOT longest, common ancestor at POS: "+search_pos);

	  // if non-zero target
	  shared_ancestor_index_pos = search_pos;
          search_pos = -1;
        } else {

          if (search_hash == lchain_ph) {
            lchain_len++;
            lchain_ph    = this.index.prevhash[search_pos];
          }
          if (search_hash == nchain_ph) {
            nchain_ph    = this.index.prevhash[search_pos];
            nchain_len++;
          }

	  // if zero target
	  shared_ancestor_index_pos = search_pos;
          search_pos--;

        }

      }


      if (nchain_len > lchain_len) {

        //
        //
        // in order to prevent our system from being gamed, we
        // require the attacking chain to have equivalent
        // or greater cumulativ burn fees. This ensures that
        // an attacker cannot lower difficulty, pump out a
        // ton of blocks, and then hike the difficulty only
        // at the last moment.
        //
        // does this matter? the difficulty should lower in
        // response to longer blocktimes, and rise in response
        // to faster blocktimes. so the effect should wash
        // out -- lowering difficulty should cost the same
        // amount of time that raising it gains.
        //
        // that said, perhaps there is a counterintuitive way
        // to game our difficulty adjustment algorithm, and
        // maybe we will have reasons to make our burn fee
        // adjustments asymmetrical, in which case attackers
        // could lower difficulty, produce blocks *slightly*
        // faster than our heartbeat but not fast enough that
        // the difficulty rises much, and then outpace our
        // main chain for less money.
        //
        //




        //console.log("UPDATING LONGEST CHAIN: "+nchain_len + " new |||||| " + lchain_len + " old");
        this.longestChain = pos;
        i_am_the_longest_chain = 1;



              // update our fast index so we know which is the longest chain
              // for fast index searches against arrays when looking for
              // block_ids or hashes or prevhashes
              //
              // this is not used by returnLongestChainIndex
              // as we rely on that to help generate this 
              // information. But it means that longer search
              // queries can scroll backwards until they find 
              // an indexed block ID with the proper variable
              // set to find the active block at any depth
              //
              if (shared_ancestor_index_pos > -1) {
                // reset to non-longest chain
                for (h = shared_ancestor_index_pos; h < this.index.lc.length; h++) {
                  this.index.lc[h] = 0;
                }

		// +1 captures the shared ancestor position
                newchain = this.returnLongestChainIndex(nchain_len+1);
                for (z = 0; z < newchain.length; z++) {
                  this.index.lc[newchain[z]] = 1;
                }
              }

      } else {

        // if the new chain is exactly the same length as the working longest chain
        // but matches our preferences more closely, we want to support it by
        // mining or building upon it.
        if (nchain_len == lchain_len) {
          latestBlock = this.returnLatestBlock();
          if (latestBlock != null) {
            if (this.voter.prefers(newblock, latestBlock)) {
              //console.log("UPDATING LONGEST CHAIN W/ PREFERENCE: "+nchain_len + " new |||||| " + lchain_len + " old");
              this.longestChain = pos;
              i_am_the_longest_chain = 1;



	      // update our fast index so we know which is the longest chain
	      // for fast index searches against arrays when looking for 
	      // block_ids or hashes or prevhashes
	      //
	      // this is not used by returnLongestChainIndex
	      // as we rely on that to help generate this 
	      // information. But it means that longer search
	      // queries can scroll backwards until they find 
	      // an indexed block ID with the proper variable
	      // set to find the active block at any depth
	      //
	      if (shared_ancestor_index_pos > -1) {
		// reset to non-longest chain
		for (h = shared_ancestor_index_pos+1; h < this.index.lc.length; h++) {
		  this.index.lc[h] = 0;
		}
		newchain = this.returnLongestChainIndex(nchain_len);
		for (z = 0; z < newchain.length; z++) {
		  this.index.lc[newchain[z]] = 1;
		}
	      }

            }
          }
        }

      }
    }
  }

  // start mining new block
  if (i_am_the_longest_chain == 1) {
    this.index.lc[pos] = 1;
    this.miner.stopMining();
    this.miner.startMining(newblock);
  }



  // write latest block data to long-term storage
  // if we don't already have it in our database
  this.app.storage.saveBlock(newblock);




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
  if (forceAdd != "force") {
    our_longest_chain = this.returnLongestChainIndex(100);
    for (i = 0; i < our_longest_chain.length; i++) {
      thisblk = this.returnBlockByHash(this.index.hash[our_longest_chain[i]]);
      thisblk.runCallbacks(i);
      this.app.storage.setBlockConfirmation(thisblk.hash(), i);
    }
  }


  /////////////////////////////////////
  // sometimes we update our fork id //
  /////////////////////////////////////
  if (newblock.returnId()%10 == 0) {
    this.updateForkId(newblock);
  }


  //////////////////////////////////////////
  // finally, we update the genesis block //
  //////////////////////////////////////////
  if (newblock.returnId() >= (this.genesis_block_id+this.genesis_period+this.fork_guard)) {
    this.updateGenesisBlock(newblock);
  }



  // reset so we can process another block
  this.currently_indexing = 0;


}
function compareTs(a, b) {
  return a -b;
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
//    console.log("we cannot verify that this is the longest chain when trying to update our genesis block, so abort");
    return;
  }
  if (this.index.hash.length < this.genesis_period) {
//    console.log("we do not have a full genesis period yet, refusing to purge anything");
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
    is_there_a_challenger = 0;

    our_block_id    = blk.returnId();
    lowest_block_id = our_block_id - this.genesis_period;

    // we cannot delete anything if our new genesis block would
    // be lower than zero.
    if (lowest_block_id <= 0) { return; }

    // otherwise, figure out what the lowest block ID is from our
    // most recently produced list of blocks. We pick the number
    // here arbitrarily, accepting a minor amount of forking as
    // the cost of having a disposible blockchain.




    for (c = 2; c <= this.fork_guard && c < this.index.block_id.length; c++) {
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



    purgePoint = (lowest_block_id - this.genesis_period);



    // first figure out how much money has been lost
    //unspent_inputs  = this.storage.returnUnspentInputsBeforeBlock(purgePoint)
    //unspent_tickets = this.storage.returnUnspentGoldenTicketsBeforeBlock(purgePoint);
    //total_unspent = (unspent_inputs + unspent_tickets).toFixed(8);
    //
    // PROBLEM it is the NEXT block that needs to check to see if the previous
    // block released any cash.... :(


    this.purgeArchivedData((purgePoint));


    // finally, update our genesis block_id to the current_block minus
    // the genesis period. We will run this function again when the
    // fork guard has passed, and if any forks have not sufficiently
    // kept pace in that time, they will be discarded them.
    this.genesis_block_id = blk.returnId() - this.genesis_period;

  }

}
Blockchain.prototype.updateForkId = function updateForkId(blk) {


  blockid     = blk.returnId();
  baseblockid = Math.floor(blockid / 10);
  baseblockid = blockid;
  fork_id     = "";
  indexpos    = this.index.hash.length-1;

  for (i = 0, stop = 0; stop == 0, i < this.genesis_period;) {

    checkpointblkid = baseblockid-i;
    indexpos = this.returnLongestChainIndexPositionByBlockId(checkpointblkid, indexpos);

    if (indexpos == -1 || checkpointblkid < 0) { stop = 1; }
    else {
      // get the hash
      th = this.index.hash[indexpos];
      fork_id += th.substring(0,2);
    }

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

console.log("LBI: "+lowest_block_id);

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



console.log("TOTAL_TO_REMOVE: "+items_before_needed);


  /////////////////////////////////////
  // delete from fast-access indexes //
  /////////////////////////////////////
  this.index.hash.splice(0, items_before_needed);
  this.index.ts.splice(0, items_before_needed);
  this.index.prevhash.splice(0, items_before_needed);
  this.index.block_id.splice(0, items_before_needed);
  this.index.lc.splice(0, items_before_needed);


  ///////////////////////////////////
  // delete from blocks separately //
  ///////////////////////////////////
console.log("Purge Data needs to remove blocks in full index if it is in sync with the main chain...");


  // update our longestChain variable
  this.longestChain = this.longestChain - items_before_needed;


console.log("PURGED OUR DATA. OLDEST IS NOW: "+this.longestChain);


  // and delete old data from our database
  this.app.storage.purgeOldBlocks(lowest_block_id);

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
Blockchain.prototype.addBlock = function addBlock(blk) {

  var hash = blk.hash('hex');

  // check block validates
  if (! blk.validate() ) {
    console.log("Block does not validate!!!");
    this.app.blockchain.mempool.removeBlock(blk);
    return 0;
  }

  // check block not already indexed
  // if it is indexed, we have some sort
  // of overtransmission and drop it
  if ( this.isHashIndexed( hash ) == 1 ) {
    console.log("Hash is already indexed: " + hash);
    return 0;
  }

  // AFTER we know it is not indexed, we
  // can try to add the block.
  if ( ! this.mempool.addBlock(blk) ) {
    return 0;
  }


  // propagate the block -- startup mempool queue to process it
  this.app.network.propagateBlock(blk);
  this.mempool.processBlocks();

}
Blockchain.prototype.importBlock = function importBlock(blkjson) {
  var nb = new saito.block(this.app, blkjson);
  this.addBlock(nb);
}









///////////////////////
// Utility Functions //
///////////////////////
Blockchain.prototype.isHashIndexed = function isHashIndexed(hash) {
  for (n = this.index.hash.length-1; n >= 0; n--) {
    if (this.index.hash[n] == hash) { 
      return 1; 
    }
  }
  return -1;
};
Blockchain.prototype.isBlockIdIndexed = function isBlockIdIndexed(block_id) {
  for (n = this.index.block_id.length-1; n >= 0; n--) {
    if (this.index.block_id[n] == block_id) { 
      return 1; 
    }
    if (this.index.block_id[n] < block_id) {
      return -1;
    }
  }
  return -1;
};







Blockchain.prototype.returnUnixtime = function returnUnixtime(blockhash) {
  // only consider the most recent 1000 blocks
//console.log("ABOUT TO COMPARE UNIXTIME");
  for (i = this.index.hash.length-1; i >= 0 && i > this.index.hash.length-1000; i--) {
//console.log("COMPARING: "+this.index.hash[i] + " -- " + blockhash);
    if (this.index.hash[i] == blockhash) {
        return this.index.ts[i];
    }
  }

  return -1;
}
Blockchain.prototype.returnLongestChain = function returnLongestChain(chainlength=10) {

console.log("1");

  if (chainlength == 0) { return []; }

console.log("2");
  chainarray  = this.returnLongestChainIndex(chainlength);
console.log("3");
console.log(chainarray);
console.log("4");

  reversearray = [];

  finished = 0;
  for (ii = chainarray.length-1; ii >= 0 && finished == 0; ii--) {
console.log("5");
console.log(chainarray[i]);

    tmpblk = this.returnBlockByHash(this.index.hash[chainarray[ii]]);
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

  for (z = 0; z < chainlength; z++) {

    prev_pos = chain_pos-1;
    prev_found = 0;

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
  start_pos = this.index.hash.length-1;
  if (spos != -1) { start_pos = spos; }
  for (c = start_pos; c >= 0; c--) {
    if (this.index.block_id[c] == blkid) {
      if (this.index.lc[c] == 1) {
	return c;
      }
    }
  }
  return -1;
}
Blockchain.prototype.returnBlockById = function returnBlockById() {
  if (this.index.hash.length == 0) { return null; }
}
Blockchain.prototype.returnLatestBlock = function returnLatestBlock() {
  if (this.blocks.length == 0) { return null; }
  for (i = this.blocks.length-1; i >= 0; i--) {
    if (this.blocks[i].hash() == this.index.hash[this.longestChain]) {
      return this.blocks[i];
    }
  }
  return null;
}
Blockchain.prototype.returnLatestBlockId = function returnLatestBlockId() {
  if (this.index.block_id.length == 0) { return 0; }
  return this.index.block_id[this.longestChain];
}
Blockchain.prototype.returnBlockByHash = function returnBlockByHash(hash) {
  if (this.blocks.length == 0) { return null; }
  for (v = this.blocks.length-1; v >= 0; v-- ) {
    if (this.blocks[v].hash() == hash) {
      return this.blocks[v];
    }
  }
  return null;
}
Blockchain.prototype.returnGenesisBlockId = function returnGenesisBlockId() {
  return this.genesis_block_id;
}







Blockchain.prototype.resetBlockchain = function resetBlockchain() {

  if (this.index.block_id.length == 0) { return; }

  // remove all of our blocks in the index
  newest_block_id = this.index.block_id[this.index.block_id.length-1];
  this.purgeArchivedData(newest_block_id);  
console.log("about to go to the network...");
  this.app.network.fetchBlockchain("lite", 0);
console.log("finished fetching blockchain data");

}



