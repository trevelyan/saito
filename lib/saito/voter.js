var saito = require('../saito');



function Voter(app) {

  if (!(this instanceof Voter)) {
    return new Voter(app);
  }

  this.app                      = app || {};

  this.voter                   = {};


  this.voter.vote_difficulty   = 0;
  this.voter.target_difficulty = 2;

  this.voter.vote_paysplit     = 0;
  this.voter.target_paysplit   = 0.5;

  return this;

}
module.exports = Voter;


Voter.prototype.initialize = function initialize() {

  if (this.app.options.voter != null) {
    this.voter.vote_difficulty   = this.app.options.voter.vote_difficulty;
    this.voter.target_difficulty = this.app.options.voter.target_difficulty;
    this.voter.vote_paysplit     = this.app.options.voter.vote_paysplit;
    this.voter.target_paysplit   = this.app.options.voter.target_paysplit;
  }

}




Voter.prototype.voteDifficulty = function voteDifficulty(difficulty) {
  if (this.voter.vote_difficulty == 1) {
    if (difficulty < target_difficulty) { return 1; }
    if (difficulty > target_difficulty) { return -1; }
    return 0;
  } else {
    return 0;
  }
}
Voter.prototype.votePaysplit   = function votePaysplit(paysplit) {
  if (this.voter.vote_paysplit == 1) {
    if (paysplit < target_paysplit) { return 1; }
    if (paysplit > target_paysplit) { return -1; }
    return 0;
  } else {
    return 0;
  }
}
// return 1 if block_a is preferred to block_b
Voter.prototype.prefers = function prefers(block_a, block_b) {

  if (block_a.block.paysplit > this.voter.target_paysplit) {

      // we want to move the paysplit down
      if (block_a.block.paysplit_vote == -1 && block_b.block.paysplit_vote > -1) { return 1; }
      if (block_a.block.paysplit_vote == 0  && block_b.block.paysplit_vote > 0)  { return 1; }

  } else {
    if (block_a.block.paysplit == this.voter.target_paysplit) {} else {

      // we want to move the paysplit up -- support
      if (block_a.block.paysplit_vote == 1 && block_b.block.paysplit_vote < 1)  { return 1; }
      if (block_a.block.paysplit_vote == 0  && block_b.block.paysplit_vote < 0) { return 1; }

    }
  }

  // no preference btween blocks
  return 0;

}







Voter.prototype.returnVoterJson = function returnVoterJson() {
  return JSON.stringify(this.returnVoter());
}
Voter.prototype.returnVoter = function returnVoter() {
  return this.voter;
}











