function Slip(add="", amt=0.0, gt=0, bid=0, tid=0, sid=0, bhash="", lc=1, ft=0, rn=-1) {

  if (!(this instanceof Slip)) {
    return new Slip(add, amt, gt, bid, tid, sid, bhash, lc, ft, rn);
  }

  this.add    = add;
  this.amt    = amt;
  this.gt     = gt;
  this.bid    = bid; 
  this.tid    = tid;
  this.sid    = sid;
  this.bhash  = bhash;
  this.lc     = lc;
  this.ft     = ft;
  this.rn     = rn;

  // set random number
  if (this.rn == -1) { this.rn = Math.floor(Math.random()*100); }

  return this;

}
module.exports = Slip;

