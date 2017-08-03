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






Server.prototype.initialize = function initialize() {

    var app = require('express')();
    var server = require('http').Server(app);
    var io = require('socket.io')(server);

    myself = this;


    ///////////////////
    // web resources //
    ///////////////////
    app.get('/', function (req, res) {
      res.sendFile(__dirname + '/web/index.html');
      return;
    });
    app.get('/client.json', function (req, res) {
      res.sendFile(__dirname + '/web/client.json');
      return;
    });
    app.get('/style.css', function (req, res) {
      res.sendFile(__dirname + '/web/style.css');
      return;
    });
    app.get('/jquery-3.2.1.min.js', function (req, res) {
      res.sendFile(__dirname + '/web/jquery-3.2.1.min.js');
      return;
    });
    app.get('/jquery-ui.min.js', function (req, res) {
      res.sendFile(__dirname + '/web/jquery-ui.min.js');
      return;
    });
    app.get('/jquery-ui.min.css', function (req, res) {
      res.sendFile(__dirname + '/web/jquery-ui.min.css');
      return;
    });


    //////////////
    // fancybox //
    //////////////
    app.get('/fancybox/jquery.fancybox.css', function (req, res) {
      res.sendFile(__dirname + '/web/fancybox/jquery.fancybox.css');
      return;
    });
    app.get('/fancybox/jquery.fancybox.pack.js', function (req, res) {
      res.sendFile(__dirname + '/web/fancybox/jquery.fancybox.pack.js');
      return;
    });
    app.get('/fancybox/jquery.fancybox-buttons.css', function (req, res) {
      res.sendFile(__dirname + '/web/fancybox/jquery.fancybox-buttons.css');
      return;
    });
    app.get('/fancybox/jquery.fancybox-buttons.js', function (req, res) {
      res.sendFile(__dirname + '/web/fancybox/jquery.fancybox-buttons.js');
      return;
    });
    app.get('/fancybox/jquery.fancybox-media.js', function (req, res) {
      res.sendFile(__dirname + '/web/fancybox/jquery.fancybox-media.js');
      return;
    });
    app.get('/fancybox/jquery.fancybox-thumbs.css', function (req, res) {
      res.sendFile(__dirname + '/web/fancybox/jquery.fancybox-thumbs.css');
      return;
    });
    app.get('/fancybox/jquery.fancybox-thumbs.js', function (req, res) {
      res.sendFile(__dirname + '/web/fancybox/jquery.fancybox-thumbs.js');
      return;
    });


    /////////////////////
    // fancybox assets //
    /////////////////////
    app.get('/fancybox/blank.gif', function (req, res) {
      res.sendFile(__dirname + '/web/fancybox/blank.gif');
      return;
    });
    app.get('/fancybox/fancybox_loading.gif', function (req, res) {
      res.sendFile(__dirname + '/web/fancybox/fancybox_loading.gif');
      return;
    });
    app.get('/fancybox/fancybox_loading@2x.gif', function (req, res) {
      res.sendFile(__dirname + '/web/fancybox/fancybox_loading@2x.gif');
      return;
    });
    app.get('/fancybox/fancybox_overlay.png', function (req, res) {
      res.sendFile(__dirname + '/web/fancybox/fancybox_overlay.png');
      return;
    });
    app.get('/fancybox/fancybox_sprite.png', function (req, res) {
      res.sendFile(__dirname + '/web/fancybox/fancybox_sprite.png');
      return;
    });
    app.get('/fancybox/fancybox_sprite@2x.png', function (req, res) {
      res.sendFile(__dirname + '/web/fancybox/fancybox_sprite@2x.png');
      return;
    });


    server.listen(this.options.port);

/***
    // update network with new peer
    io.on('connection', function (socket) {
      console.log("CONNECTION adding socket to peer list...");
      myself.app.network.addPeerWithSocket(socket);
    });
***/

}







