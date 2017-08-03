var saito         = require('../saito');


function Transaction(txjson="") {

  if (!(this instanceof Transaction)) {
    return new Transaction(txjson);
  }


  ////////////////////////
  // included in blocks //
  ////////////////////////
  this.transaction               = {};
  this.transaction.from          = [];    // from (payslip)
  this.transaction.to            = [];    // to (payslip)
  this.transaction.ts            = "";    // timestamp / unixtime
  this.transaction.sig           = "";    // signature of block
  this.transaction.ver           = 1;
  this.transaction.path          = [];    // transaction path
  this.transaction.id            = 1;
  this.transaction.gt            = null;  // golden ticket
  this.transaction.msg           = {};    // message field
  this.transaction.msig          = "";    // signature of message field
  this.transaction.ps            = 0;     // paysplit


  ////////////////////////////
  // not included in blocks //
  ////////////////////////////
  this.fee                               = -1;


  /////////////////////////
  // or create from JSON //
  /////////////////////////
  if (txjson != "") {
    this.transaction = JSON.parse(txjson);
  }

  return this;

}
module.exports = Transaction;


