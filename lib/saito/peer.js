var saito        = require('../saito');
var io           = require('socket.io-client');
var util         = require('util');
var EventEmitter = require('events').EventEmitter;




/////////////////
// CONSTRUCTOR //
/////////////////
function Peer(app, peerjson="") {

  if (!(this instanceof Peer)) {
    return new Peer(app, peerjson);
  }

  //EventEmitter.call(this);


  this.app = app || {};

  this.options             = {};
  this.options.host        = "localhost";
  this.options.port        = "12100";
  this.options.publickey   = "";

  this.socket              = null;
  this.socket_id           = null;


  if (peerjson != "") {
    this.options = JSON.parse(peerjson);
  }

  return this;

}
//util.inherits(Peer, EventEmitter);
module.exports = Peer;




Peer.prototype.returnJson = function returnJson() {
  return JSON.stringify(this.options);
}




