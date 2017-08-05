


function Mods(app) {

  if (!(this instanceof Mods)) {
    return new Mods(app);
  }

  this.app     = app;
  this.mods    = [];

  return this;

}
module.exports = Mods






Mods.prototype.affixCallbacks = function affixCallbacks(txindex, message, callbackArray, callbackIndexArray) {
  for (i = 0; i < this.mods.length; i++) {
    if (message.module == this.mods[i].name) {
     callbackArray.push(this.mods[i].onConfirmation);
      callbackIndexArray.push(txindex);
    }
  }
}







