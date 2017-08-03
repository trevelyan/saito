function Slip(add, amt=0.0) {

  if (!(this instanceof Slip)) {
    return new Slip(add, amt);
  }

  this.add  = add; // address
  this.amt  = amt; // amount

  return this;

}
module.exports = Slip;


