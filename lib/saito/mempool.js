var saito = require('../saito');


function Mempool(app) {

  if (!(this instanceof Mempool)) {
    return new Mempool(app);
  }

  this.app                      = app || {};

  /////////////
  // mempool //
  /////////////
  this.transactions             = []; // array
  this.blocks                   = []; // queue


  ///////////////////////
  // processing blocks //
  ///////////////////////
  this.processing_blocks        = 0;
  this.processing_timer         = null;
  this.processing_speed         = 200; // 0.2 seconds


  ///////////////////////////
  // bundling transactions //
  ///////////////////////////
  this.bundling_blocks          = 0;
  this.bundling_timer           = null;
  this.bundling_speed           = 350; // 0.5 seconds
  this.processing_bundle        = 0;

  return this;

}
module.exports = Mempool;


