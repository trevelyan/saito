var saito = require('../saito');


function Miner(app) {

  if (!(this instanceof Miner)) {
    return new Miner(app);
  }

  this.app                      = app || {};


  this.mining                   = 0;    // do we mine blocks
  this.mining_timer             = null; // timer to loop creating block
  this.mining_speed             = 500;  // try to create a block every half-second
  this.currently_mining         = 0;    // timer to loop creating block

  return this;

}
module.exports = Miner;



//////////////////////
// Mining Functions //
//////////////////////
Miner.prototype.startMining = function startMining(blk) {

  if (this.currently_mining == 1) { clearInterval(this.mining_timer); }
  this.currently_mining = 1;

  miner_self = this;

  this.mining_timer = setInterval(function(){
    miner_self.attemptSolution(blk);
  }, this.mining_speed);

}
Miner.prototype.stopMining = function stopMining() {
  clearInterval(this.mining_timer);
}
Miner.prototype.attemptSolution = function attemptSolution(prevblock) {

  var ourPrivateKey = this.app.crypt.generateKeys();
  var ourPublicKey  = this.app.crypt.returnPublicKey(ourPrivateKey);

  h1 = ourPublicKey.slice((-1 * prevblock.returnDifficulty()));
  h2 = prevblock.hash().slice((-1 * prevblock.returnDifficulty()));

  //console.log(h1 + " -- " + h2);

  if (h1 == h2) {

    console.log("\n\n\nGOLDEN TICKET found when mining....\n");
    // stop mining for now
    this.stopMining();

    // determine how much money the previous block leaves for us all
    // and create a transaction that treats the BLOCK itself as an
    // input with two outputs: one for us and one for charlie.
    var txfees_total  = parseFloat(0.0 + prevblock.calculateTransactionFees()).toFixed(8);
    var txfees_needed = parseFloat(0.0 + prevblock.calculateTransactionFeesNeeded(prevblock.block.prevhash)).toFixed(8);
    var total_revenue = parseFloat(txfees_needed) + parseFloat(prevblock.block.coinbase);
    var miner_share   = parseFloat(total_revenue * prevblock.block.paysplit).toFixed(8);
    var node_share    = (total_revenue - miner_share).toFixed(8);
    if (node_share < 0)             { node_share = 0; }


    // we have solved the puzzle, to generate the proof we hash and
    // sign the target_hash with our private key. Providing the
    // public key and the hash thus demonstrates proof of our holding
    // a private key that solves the puzzle. We also include our
    // two votes and two shares so that they can be verified as well
    solution                 = {};
    solution.target          = prevblock.hash();
    solution.difficulty      = prevblock.returnDifficulty();
    solution.difficulty_vote = this.app.blockchain.voter.returnDifficultyVote(solution.difficulty);
    solution.paysplit_vote   = prevblock.returnPaysplitVote();
    solution.pubkey          = ourPublicKey;
    solution.miner_share     = miner_share;
    solution.node_share      = node_share;

    solmsg                   = solution.target+solution.difficulty_vote+solution.paysplit_vote+solution.miner_share+solution.node_share;
    solution.signature       = this.app.crypt.signMessage(solmsg, ourPrivateKey);




    // find which of the previous block transactions is Charlie
    // based on the hexadecimal number in our signature turned
    // into a selection mechanism for a walk through an array
    // of contenders
    var children  = prevblock.returnGoldenTicketContenders();
    var winner    = solution.signature.slice((-1 * (children.length)));
    var winnerInt = parseInt(winner, 16);
    var charlie   = children[winnerInt%children.length];

    var winners    = [];
        winners[0] = new saito.slip(this.app.wallet.returnAddress(), miner_share);
        winners[1] = new saito.slip(charlie, node_share);


    // create a transaction to claim the reward
    nt = this.app.wallet.createGoldenTransaction(winners, solution);

    // add it to mempool and broadcast out into the network
    this.app.blockchain.mempool.addTransaction(nt);
    this.app.network.propagateGoldenTicket(nt);


  }
}











