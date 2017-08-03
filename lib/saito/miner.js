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





