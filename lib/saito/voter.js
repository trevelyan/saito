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


  if (voterjson != "") {
    this.voter = JSON.parse(voterjson);
  }


  return this;

}
module.exports = Voter;





