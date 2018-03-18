var saito    = require('../saito');


function Path(from="", to="", sig="") {

  if (!(this instanceof Path)) {
    return new Path(from,to,sig);
  }
  this.from = from;
  this.to   = to;
  this.sig  = sig;

  return this;

}
module.exports = Path;


Path.prototype.returnFrom = function returnFrom() {
  return this.from;
}
Path.prototype.returnTo = function returnTo() {
  return this.to;
}
Path.prototype.returnSig = function returnSig() {
  return this.sig;
}

