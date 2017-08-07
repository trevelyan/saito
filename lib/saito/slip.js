function Slip(add, amt=0.0, gt=0, bid=0, tid=0, sid=0) {

  if (!(this instanceof Slip)) {
    return new Slip(add, amt);
  }

  this.add    = add; // address
  this.amt    = amt; // amount
  this.gt     = gt;  // is this referencing a golden ticket
  this.bid  = bid; 
  this.tid   = tid;
  this.sid = sid;

  return this;

}
module.exports = Slip;


Slip.prototype.returnAddress = function returnAddress() {
  return this.add;
}
Slip.prototype.returnAmount = function returnAmount() {
  return parseFloat(this.amt).toFixed(8);
}
Slip.prototype.setAddress = function setAddress(x) {
  this.add = x;
}
Slip.prototype.setAmount = function setAmount(x) {
  this.amt = x;
}


