var saito = require('../../../../../../saito');
var ModTemplate = require('../../../../../template');
var util = require('util');



//////////////////
// CONSTRUCTOR  //
//////////////////
//
// You do not need to change this.
//
function RemixApp(app) {

  if (!(this instanceof RemixApp)) { return new RemixApp(app); }

  RemixApp.super_.call(this);

  this.app             = app;
  this.name            = "RemixApp";

  return this;

}
module.exports = RemixApp;
util.inherits(RemixApp, ModTemplate);



//////////////////
// Confirmation //
//////////////////
//
// This callback is run by every computer running your module every time 
// a "RemixApp" transaction receives a confirmation. This is why we check 
// to see if we are the recipient...
//
RemixApp.prototype.onConfirmation = function onConfirmation(blk, tx, conf, app) {

  var remix_self = app.modules.returnModule("RemixApp");

  // on the first confirmation
  if (conf == 0) {

    // if message is for us...
    if (tx.transaction.to[0].add == app.wallet.returnPublicKey()) {


      // do something ...


      // and email us ...
      msg          = {};
      msg.id       = tx.transaction.id;
      msg.from     = tx.transaction.from[0].add;
      msg.time     = tx.transaction.ts;
      msg.module   = tx.transaction.msg.module;
      msg.title    = "You have received a " + msg.module + " message";
      msg.data     = "The email client treats msg.data field as email content";
      msg.markdown = 1;  // 0 = display as HTML
                         // 1 = display as markdown

      app.modules.returnModule("Email").attachMessage(msg, app);
      app.archives.saveMessage(tx);

    }
  }
}



