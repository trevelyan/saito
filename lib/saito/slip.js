function Slip(add="", amt=0.0, gt=0, bid=0, tid=0, sid=0, bhash="", lc=1, ft=0) {

  if (!(this instanceof Slip)) {
    return new Slip(add, amt, gt, bid, tid, sid, bhash, lc, ft);
  }

  this.add    = add; 	// address
  this.amt    = amt; 	// amount
  this.gt     = gt;  	// is this referencing a golden ticket
  this.bid    = bid; 
  this.tid    = tid;
  this.sid    = sid;
  this.bhash  = bhash; 	// block hash
  this.lc     = lc;    	// longest chain
  this.ft     = ft;  	// is this capturing fees for the miner

  return this;

}
module.exports = Slip;

