var saito = require('../saito');


function Queue(app) {

  if (!(this instanceof Queue)) {
    return new Queue(app);
  }

  this.app                        = app || {};

  /////////////
  // actions //
  /////////////
  this.actions                    = []; // array


  ////////////////////////
  // processing actions //
  ////////////////////////
  this.processing_actions         = 0;
  this.processing_timer           = null;
  this.processing_speed           = 4000; // 4 seconds


  return this;

}
module.exports = Queue;




Queue.prototype.initialize = function initialize() {

  queue_self = this;
/***
  this.processing_timer = setInterval(function() {
    console.log("This is a test");
  }, this.processing_speed);
***/

}



Queue.prototype.runCallback = function runCallback(callbackfunc, arrayofparams, chainedcallback) {

  success = 0;

  if (arrayofparams.length == 1) { 
				   success = callbackfunction(	
							arrayofparams[0]); 
				 }
  if (arrayofparams.length == 2) { 
				   success = callbackfunction(	
							arrayofparams[0], 
							arrayofparams[1]);
				 }
  if (arrayofparams.length == 3) { 
				   success = callbackfunction(	
							arrayofparams[0], 
							arrayofparams[1], 
							arrayofparams[2]); 
				 }  
  if (arrayofparams.length == 4) { 
				   success = callbackfunction(	
							arrayofparams[0], 
							arrayofparams[1], 
							arrayofparams[2], 
							arrayofparams[3]); 
				 }  

  if (success == 1) {
    chainedcallback();
  }

}



