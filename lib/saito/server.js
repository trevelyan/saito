var saito        = require('../saito');
var net          = require('net');
var http         = require('http');
var util         = require('util');
//var EventEmitter = require('events').EventEmitter;



function Server(app) {

  if (!(this instanceof Server)) {
    return new Server(app);
  }

  //EventEmitter.call(this);

  this.app             = app || {};

  this.options         = {};
  this.options.host    = "localhost";
  this.options.port    = 12100;
  this.server          = null;
  this.io              = null;


  return this;

}
//util.inherits(Server, EventEmitter);
module.exports = Server;




