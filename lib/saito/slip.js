function Slip(add="", amt=0.0, gt=0, bid=0, tid=0, sid=0, bhash="", lc=1, ft=0, rn=-1) {

  if (!(this instanceof Slip)) {
    return new Slip(add, amt, gt, bid, tid, sid, bhash, lc, ft, rn);
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
  this.rn     = rn;     // random number 0-999


  // we use the random number to select a child 
  // for processing. In the future we can save
  // space by using the address, but this is 
  // useful to have for testing purposes, as 
  // our spammer module sends and receives from 
  // a single address.
  if (this.rn == -1) {  
    this.rn = Math.floor(Math.random()*100);
  }

  return this;

}
module.exports = Slip;

