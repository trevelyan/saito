function Slip(add="", amt=0.0, gt=0, bid=0, tid=0, sid=0, bhash="", lc=1) {

  if (!(this instanceof Slip)) {
    return new Slip(add, amt, gt, bid, tid, sid, bhash, lc);
  }

  this.add    = add; 	// address
  this.amt    = amt; 	// amount
  this.gt     = gt;  	// is this referencing a golden ticket
  this.bid    = bid; 
  this.tid    = tid;
  this.sid    = sid;
  this.bhash  = bhash; 	// block hash
  this.lc     = lc;    	// longest chain

  // used by wallet only
  this.spent  = 0;    	// default unspent

  return this;

}
module.exports = Slip;




