var saito    = require('../saito');

function GoldenTicket(app, gtjson="") {

  if (!(this instanceof GoldenTicket)) {
    return new GoldenTicket(app, gtjson);
  }
  this.app = app || {};

  this.solution 		= {};
  this.solution.target 		= "";
  this.solution.difficulty 	= "";
  this.solution.difficulty_vote	= "";
  this.solution.paysplit 	= "";
  this.solution.paysplit_vote 	= "";
  this.solution.pubkey	 	= "";
  this.solution.miner_share 	= 0;
  this.solution.node_share 	= 0;
  this.solution.sig		= "";

  if (gtjson != "") {
    this.solution = JSON.parse(gtjson);
  }

}
module.exports = GoldenTicket;


GoldenTicket.prototype.calculateDifficulty = function calculatDifficulty(prevblock) {
  if (this.solution.difficulty_vote == -1) {
    return (prevblock.returnDifficulty() - 0.0001).toFixed(8);
  }
  if (this.solution.difficulty_vote == 1) {
    return (prevblock.returnDifficulty() + 0.0001).toFixed(8);
  }
  return prevblock.returnDifficulty();
}
GoldenTicket.prototype.calculateMonetaryPolicy = function calculateMonetaryPolicy(prevblk) {

  var prev_treasury = prevblk.returnTreasury();
  var prev_reclaimed = prevblk.returnReclaimed();
  var prev_coinbase = prevblk.returnCoinbase();

  //console.log(prev_treasury + " -- " + prev_reclaimed + " -- " + parseFloat(prev_treasury) + " -- " + this.solution.miner_share + " -- " + this.solution.node_share);

  prev_treasury = (parseFloat(prev_treasury) + parseFloat(prev_reclaimed)).toFixed(9);
  prev_treasury = prev_treasury.substring(0, prev_treasury.length-1);

  prev_treasury = (parseFloat(prev_treasury) - this.solution.miner_share).toFixed(8);
  prev_treasury = (parseFloat(prev_treasury) - this.solution.node_share).toFixed(8);

  // this removes the last digit without rounding
  prev_coinbase = (prev_treasury / prevblk.app.blockchain.genesis_period).toFixed(9);
  prev_coinbase = prev_coinbase.substring(0, prev_coinbase.length-1);

  var mp = [];
  mp[0]  = prev_treasury;
  mp[1]  = prev_coinbase;

  return mp;

}
GoldenTicket.prototype.calculatePaysplit = function calculatePaysplit(prevblock) {
  if (this.solution.paysplit_vote == -1) {
    return (prevblock.returnPaysplit() - 0.0001).toFixed(8);
  }
  if (this.solution.paysplit_vote == 1) {
    return (prevblock.returnPaysplit() + 0.0001).toFixed(8);
  }
  return prevblock.returnPaysplit();
}
GoldenTicket.prototype.createSolution = function createSolution(block_to_solve, solution_public_key, solution_private_key) {

    // this code is repeated in several places
    //
    // 1. the "validate" Golden Ticket function below
    // 2. block validation of treasury and coinbase (validateReclaimedFunds)
    // 3. block creation of treasury and coinbase 
    //
    var txfees_needed = parseFloat(0.0 + block_to_solve.returnTransactionFeesNeeded(block_to_solve.block.prevhash)).toFixed(8);
    var total_revenue = parseFloat(txfees_needed) + parseFloat(block_to_solve.block.coinbase);
    var miner_share   = parseFloat(total_revenue * block_to_solve.block.paysplit).toFixed(8);
    var node_share    = (total_revenue - miner_share).toFixed(8);
    if (node_share    < 0)             { node_share = 0; }

    this.solution.target          = block_to_solve.returnHash();
    this.solution.difficulty      = block_to_solve.returnDifficulty();
    this.solution.difficulty_vote = this.app.blockchain.voter.returnDifficultyVote(this.solution.difficulty);
    this.solution.paysplit        = block_to_solve.returnPaysplit();
    this.solution.paysplit_vote   = block_to_solve.returnPaysplitVote();
    this.solution.pubkey          = solution_public_key;
    this.solution.miner_share     = miner_share;
    this.solution.node_share      = node_share;
    this.solution.sig             = this.app.crypt.signMessage(this.returnSignatureSource(), solution_private_key);
    
}
GoldenTicket.prototype.findWinners = function findWinners(block_to_solve) {

    var winners    = [];

    // find which of the previous block transactions is Charlie
    // based on the hexadecimal number in our signature turned
    // into a selection mechanism for a walk through an array
    // of contenders
    var children  = block_to_solve.returnGoldenTicketContenders();
    var winner    = this.solution.sig.slice((-1 * (children.length)));
    var winnerInt = parseInt(winner, 16);
    var charlie   = children[winnerInt%children.length];

    winners[0] = new saito.slip(this.app.wallet.returnAddress(), this.solution.miner_share, 1);
    winners[1] = new saito.slip(charlie, this.solution.node_share, 1);

    if (winners[1].add == "") { winners[1].add = winners[0].add; }

    return winners;

}
GoldenTicket.prototype.returnSignatureSource = function returnSignatureSource() {
 return this.solution.target + 
	this.solution.difficulty_vote + 
	this.solution.paysplit_vote + 
	this.solution.miner_share +
	this.solution.node_share;
}
GoldenTicket.prototype.validate = function validate(prevblk, thisblk) {

  // validate signature
  if (this.app.crypt.verifyMessage(this.returnSignatureSource(), this.solution.sig, this.solution.pubkey) == false) {
        console.log("Golden Ticket does not validate!");
        return 0;
  }

  // see (this.createSolution) comment
  var txfees_needed = parseFloat(0.0 + prevblk.returnTransactionFeesNeeded(prevblk.block.prevhash)).toFixed(8);
  var total_revenue = parseFloat(txfees_needed) + parseFloat(prevblk.block.coinbase);
  var miner_share   = parseFloat(total_revenue * prevblk.block.paysplit).toFixed(8);
  var node_share    = (total_revenue - miner_share).toFixed(8);
  if (node_share < 0)             { node_share = 0; }

  // validate paysplit vote
  if (this.solution.paysplit_vote != prevblk.returnPaysplitVote()) {
    console.log("Paysplit vote does not match previous block");
    return 0;
  }

  // we cannot validate shares if 2nd last block is null
  if (prevblk.block.prevhash == "" || prevblk.block.prevhash == null) {
    if (miner_share != this.solution.miner_share) {
      console.log("Miner Share does not equal what it should: "+miner_share + " -- " + this.solution.miner_share);
      return 0;
    }
    if (node_share != this.solution.node_share) {
      console.log("Node Share does not equal what it should: "+node_share + " -- " + this.solution.node_share);
      return 0;
    }
  }
  return 1;
}
GoldenTicket.prototype.validateMonetaryPolicy = function validateMonetaryPolicy(adjusted_treasury, adjusted_coinbase, prevblock) {

  var mp = this.calculateMonetaryPolicy(prevblock);

  if (mp[0] != adjusted_treasury) { 
    console.log("Treasury invalid: " + adjusted_treasury + " -- " + mp[0]);
    return 0;
  }
  if (mp[1] != adjusted_coinbase) { 
    console.log("Coinbase invalid: " + adjusted_coinbase + " -- " + mp[1]);
    return 0;
  }

  return 1;

}

