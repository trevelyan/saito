var saito = require('../saito');


function Miner(app) {

  if (!(this instanceof Miner)) {
    return new Miner(app);
  }

  this.app                      = app || {};

  this.mining                   = 1;    // do we mine blocks
  this.mining_timer             = null; // timer to loop creating block
  this.mining_speed             = 500;  // try to create a block every half-second
  this.currently_mining         = 0;    // timer to loop creating block

  return this;

}
module.exports = Miner;


Miner.prototype.startMining = function startMining(blk) {

  if (this.currently_mining == 1) { clearInterval(this.mining_timer); }
  this.currently_mining = 1;

  var miner_self = this;

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

  var decDifficulty = (prevblock.returnDifficulty() - Math.floor(prevblock.returnDifficulty()));
  var decDifficulty = decDifficulty.toFixed(8);
  var intDifficulty = Math.floor(prevblock.returnDifficulty());

  var h1 = null;
  var h2 = null;

  if (intDifficulty == 0) {
    h1 = 1;
    h2 = 1;
  } else {
    h1 = ourPublicKey.slice((-1 * intDifficulty));
    h2 = prevblock.returnHash().slice((-1 * intDifficulty));
  }

  if (h1 == h2) {

    var h3 = ourPublicKey.toString().toLowerCase()[ourPublicKey.length-1-intDifficulty];
    var h4 = parseInt(h3,16);
    var intTheDiff = Math.floor((decDifficulty * 10000));
    var intModBase = 625;
    var intResult  = Math.floor((intTheDiff/intModBase));

    if (h4 >= intResult) {

      this.stopMining();

      var gt = new saito.goldenticket(this.app);
      gt.createSolution(prevblock, ourPublicKey, ourPrivateKey);

      // find the winners
      var winners = gt.findWinners(prevblock);

      // create golden transaction
      var nt = this.app.wallet.createGoldenTransaction(winners, gt.solution);

      // add to mempool and broadcast
      this.app.blockchain.mempool.addTransaction(nt);
      this.app.network.propagateGoldenTicket(nt);

    }
  }
}


