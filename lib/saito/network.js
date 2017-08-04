var saito = require('../saito');




/////////////////
// CONSTRUCTOR //
/////////////////
function Network(app) {

  if (!(this instanceof Network)) {
    return new Network(app);
  }

  this.app     = app || {};

  this.peers    = [];

  return this;

}
module.exports = Network;




Network.prototype.returnJson = function returnJson() {
  peerarray = [];
  for (i = 0; i < this.peers.length; i++) {
    peerarray.push(this.peers.returnJson());
  }
  return JSON.stringify(peerarray);
}


