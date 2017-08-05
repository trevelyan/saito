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
  this.genesis_period          = 10;        // adjust the genesis hash each N blocks
  this.genesis_ts              = 0;         // unixtime of earliest block
  this.genesis_block_id        = 0;         // earlier block_id we care about
  this.fork_guard              = 5;         // discard forks that fall N blocks behind


  ///////////////////
  // Longest Chain //
  ///////////////////
  this.longestChain            = 0; // position of longest chain in indices


  ////////////
  // Blocks //
  ////////////
  this.blocks                  = [];


  /////////////
  // Indexes //
  /////////////
  this.index = {
    hash:     [],                       // hashes
    prevhash: [],                       // hash of previous block
    ts:       [],                       // timestamps
  };



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
Blockchain.prototype.indexAndStore = function indexAndStore(newblock, forceAdd="no") {

  console.log("Adding "+newblock.hash()+" to index");

  var hash           = newblock.hash('hex');
  var ts             = newblock.block.unixtime;
  var prevhash       = newblock.block.prevhash;


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
    console.log("Block Hash: "+hash+" matches hash in transaction history...");
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


  //////////////////
  // insert block //
  //////////////////
  var blkpos   = 0;
  var found    = 0;


  // we use a separate search since we purge our blocks
  // after a certain amount of time (separately from the 
  // purge of old data from the blockchain)
  for (i = this.blocks.length-1; i >= 0 && found == 0; i--) {
    if (newblock.block.unixtime > this.blocks[i].unixtime) {
      blkpos = i+1;
      found = 1;
    }
  }
  this.blocks.splice(blkpos, 0, newblock);
 


  ///////////////////////////////////////////
  // tell our block to affix its callbacks //
  ///////////////////////////////////////////
  this.blocks[blkpos].affixCallbacks();






  /////////////////////////////
  // track the longest chain //
  /////////////////////////////
  var i_am_the_longest_chain = 0;

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
    if (this.returnLatestBlock.burn_fee > newblock.burn_fee) {

      i_am_the_longest_chain = 0;

      //
      //
      // does this make sense as a first stab at the problem?
      //
      //
      // yes... put here it prevents the network from ever adjusting
      // the difficult down... unless the previous node was
      // the longest chain, in which case subsequent blocks
      // can do whatever they want. Increasing difficulty thus
      // becomes a defensive strategy that increases costs
      // to attackers.

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
          //console.log("Prev NOT longest, common ancestor at POS: "+search_pos);
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




        console.log("UPDATING LONGEST CHAIN: "+nchain_len + " new |||||| " + lchain_len + " old");
        this.longestChain = pos;
        i_am_the_longest_chain = 1;

      } else {


        // if the new chain is exactly the same length as the working longest chain
        // but matches our preferences more closely, we want to support it by
        // mining or building upon it.
        if (nchain_len == lchain_len) {
          latestBlock = this.returnLatestBlock();
          if (latestBlock != null) {
            if (this.voter.prefers(newblock, latestBlock)) {
              console.log("UPDATING LONGEST CHAIN W/ PREFERENCE: "+nchain_len + " new |||||| " + lchain_len + " old");
              this.longestChain = pos;
              i_am_the_longest_chain = 1;
            }
          }
        }

      }
    }
  }

  // start mining new block
  if (i_am_the_longest_chain == 1) {
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
  if (forceAdd != "force") {
    our_longest_chain = this.returnLongestChainIndex(100);
    for (i = 0; i < our_longest_chain.length; i++) {
      thisblk = this.returnBlockByHash(this.index.hash[our_longest_chain[i]]);
      thisblk.runCallbacks(i);
    }
  }



  //////////////////////////////////////////
  // finally, we update the genesis block //
  //////////////////////////////////////////
  if (newblock.returnId() >= (this.genesis_block_id+this.genesis_period+this.fork_guard)) {
    this.updateGenesisBlock(newblock);
  }





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
Blockchain.prototype.updateGenesisBlock = function updateGenesisBlock(blk) {


  // we need to make sure this is not a random block that is disconnected
  // from our previous genesis_id. If there is no connection between it
  // and us, then we cannot delete anything as otherwise the provision of
  // the block may be an attack on us intended to force us to discard
  // actually useful data.
  //
  // we handle this by only proceeding if the block is the head of the
  // verified longest chain.
  if (this.blocks[this.longestChain].hash('hex') != blk.hash('hex')) {
    console.log("we cannot verify that this is the longest chain when trying to update our genesis block, so abort");
    return;
  }
  if (this.blocks.length < this.genesis.period) {
    //console.log("we do not have a full genesis period yet, refusing to purge anything");
    return;
  }



  // if our block id is greater than the genesis block plus our
  // expected block period plus our expected fork guard, we check
  // to see if we can throw out data we no longer need to worry about.
  if (blk.returnId() >= (this.genesis.block_id+this.genesis.period+this.genesis.fork_guard)) {

    // then check the last 100 blocks and see if there is a viable
    // competing chain. If there is no viable competing chain
    // we plow ahead. If there is a viable competing chain then
    // we take the lowest block_id in our scan and just delete
    // the stuff that isn't needed given our assumption that the
    // lowest block_id may be a viable chain. If it continues to
    // fall behind it will be deleted naturally next time....
    is_there_a_challenger = 0;


    our_block_id    = blk.returnId();
    lowest_block_id = our_block_id - this.genesis.period;

    // we cannot delete anything if our new genesis block would
    // be lower than zero.
    if (lowest_block_id <= 0) { return; }

    // otherwise, figure out what the lowest block ID is from our
    // most recently produced list of blocks. We pick the number
    // here arbitrarily, accepting a minor amount of forking as
    // the cost of having a disposible blockchain.


    for (c = 2; c <= this.genesis.fork_guard && c < this.blocks.length; c++) {
      if (this.blocks[this.blocks.length-c].returnId < lowest_block_id) {
        lowest_block_id = this.blocks[this.blocks.length-2].returnId();
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


    purgePoint = (lowest_block_id-this.genesis.period);

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
    this.genesis.block_id = blk.returnId()-this.genesis.period;

  }

}


Blockchain.prototype.purgeArchivedData = function purgeArchivedData(lowest_block_id) {

  var items_before_needed = 0;

  // find the number of items in our blockchain before
  // we run into the lowest_block_id. Remember that blocks
  // are going to be sequential so it is only forks that
  // we really worry about
  for (x = 0; x < this.blocks.length; x++) {
    if (this.blocks.length < lowest_block_id) {
      items_before_needed;
    }
    else { x = this.blocks_length; }
  }


  /////////////////////////////////////
  // delete from fast-access indexes //
  /////////////////////////////////////
  this.index.hash.splice(0, items_before_needed);
  this.index.ts.splice(0, items_before_needed);
  this.index.prevhash.splice(0, items_before_needed);


  // update our longestChain variable
  this.longestChain = this.longestChain - items_before_needed;


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
    return 0;
  }

  // check block in mempool
  if ( ! this.mempool.addBlock(blk) ) {
    console.log("block already in mempool");
    return 0;
  }

  // propagate the block -- startup mempool queue to process it
  //this.app.network.propagateBlock(blk);
  this.mempool.processBlocks();

}
Blockchain.prototype.importBlock = function importBlock(blkjson) {
  var nb = new trust.block(this.app, blkjson);
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







Blockchain.prototype.returnUnixtime = function returnUnixtime(blockhash) {
  // only consider the most recent 1000 blocks
  for (i = this.index.hash.length-1; i > this.index.hash.length-1000; i--) {
    if (this.index.hash[i] == blockhash) {
        return this.index.ts[i];
    }
  }

  return -1;
}
Blockchain.prototype.returnLongestChainIndex = function returnLongestChainIndex(chainlength=10) {
  if (this.index.hash.length == 0) { return ""; }

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
Blockchain.prototype.returnBlockByHash = function returnBlockByHash(hash) {
  if (this.blocks.length == 0) { return null; }
  for (i = this.blocks.length-1; i >= 0; i-- ) {
    if (this.blocks[i].hash() == hash) {
      return this.blocks[i];
    }
  }
  return null;
}







