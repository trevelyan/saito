
var saito = require('../../saito');
var ModTemplate = require('../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Email(app) {

  if (!(this instanceof Email)) { return new Email(app); }
  Email.super_.call(this);

  this.app             = app;
  this.name            = "Email";

  return this;

}
module.exports = Email;
util.inherits(Email, ModTemplate);










////////////////////
// Install Module //
////////////////////
Email.prototype.installModule = function installModule() {

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_emails (\
                id INTEGER, \
                from TEXT, \
                to TEXT, \
                email TEXT, \
                unixtime INTEGER, \
                PRIMARY KEY(id ASC) \
        )";

  // database reads and writes are non-blocking, so you need a callback function if you want
  // to do anything after insert. Parameters are sql query, params and the callback function
  this.app.storage.execDatabase(sql, {}, function() { console.log("Email Database Tables Created"); });

}







//////////////////
// Confirmation //
//////////////////
Email.prototype.onConfirmation = function onConfirmation(tx, conf, app) {

  if (tx.transaction.payment.to[0].address != app.wallet.returnPublicKey()) { return; }

  if (conf == 1) {

    if (app.BROWSERIFY == 0) { return; }

    // fetch data from app
    msg = {};
    msg.id     = tx.transaction.id;
    msg.time   = new Date().getTime();
    msg.module = this.name;
    msg.from   = tx.transaction.payment.from[0].address;
    msg.title  = tx.transaction.message.title;
    msg.json   = tx.transaction.message.body;

    app.browser.attachMessage(msg);
    app.storage.saveMessage(tx);

  }

}




/////////////////////////////
// Display User Input Form //
/////////////////////////////
Email.prototype.displayUserInputForm = function displayUserupdateBrowser() {

  element_to_edit = $('#module_editable_space');
  element_to_edit_html = '<input type="text" class="email_title" id="email_title" value="new email" /><p></p><textarea class="email" id="email" name="email"></textarea>';
  element_to_edit_css  = '<style>.email{width:100%;height:300px;padding:4px;} .email_title{width:100%;padding:5px;font-size:1.2em;}</style>';

  element_to_edit.html(element_to_edit_html + element_to_edit_css);

}







/////////////////////
// Display Message //
/////////////////////
Email.prototype.displayMessage = function displayMessage(message_id, app) {

  if (app.BROWSERIFY == 1) {

    // json is simply email content in basic email module
    message_text_selector = "#" + message_id + " > .json";
    emailbody = $(message_text_selector).text();

    // json is simply email content in basic email module
    message_text_selector = "#" + message_id + " > .title";
    emailtitle = $(message_text_selector).text();

    // update title
    inserthtml = '<div class="message_title">'+emailtitle+'</div><div class="message_body">'+emailbody+'</div>';
    insertcss = '<style type="text/css">.message_title {font-weight: bold; margin-bottom: 20px; font-size:1.2em; margin-top:10px; } .message_body {}</style>';
    $('#lightbox_message_text').html(inserthtml + insertcss);

  }

}







/********
Email.prototype.attachMessage = function attachMessage(tx, app) {

    // fetch data from app
    msg = {};
    msg.id    = tx.id;
    msg.time  = new Date().getTime();
    msg.module = this.name;
    msg.from  = tx.payment.from[0].address;
    msg.title = tx.message.title;
    msg.json = tx.message.body;
 
    app.browser.attachMessage(msg);

}
Email.prototype.attachMessageToBrowser= function attachMessageToBrowser(tx, app, brwsr) {

    // fetch data from app
    msg = {};
    msg.id    = tx.id;
    msg.time  = this.formatDate(new Date().getTime());
    msg.module = this.name;
    msg.from  = tx.payment.from[0].address;
    msg.title = tx.message.title;
    msg.json = tx.message.body;
 
    brwsr.attachMessage(msg);

}
Email.prototype.formatDate = function formatDate(unixtime) {

  x = new Date(unixtime);

  return x.getDate() + "/" + (x.getMonth()+1) + "/" + x.getFullYear() + " " + x.getHours() + ":" + x.getMinutes();

}











////////////////////
// Format Message //
////////////////////
Email.prototype.formatMessage = function formatMessage(tx, app) {

  // always set the message.module to the name of the app
  tx.transaction.message.module = this.name;
  tx.transaction.message.body  = $('#email').val();
  tx.transaction.message.title  = $('#email_title').val();

  return tx;

}


******/





