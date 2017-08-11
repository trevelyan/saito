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
  this.app.storage.execDatabase(sql, {}, function() {});

}







//////////////////
// Confirmation //
//////////////////
Email.prototype.onConfirmation = function onConfirmation(tx, conf, app) {

  if (tx.transaction.to[0].returnAddress() != app.wallet.returnPublicKey()) { return; }

  // email is zero-conf
  if (conf == 0) {

    if (app.BROWSERIFY == 0) { return; }

    // fetch data from app
    msg = {};
    msg.id    = tx.transaction.id;
    msg.time  = formatDate(tx.transaction.ts);
    msg.from  = tx.transaction.from[0].returnAddress();
    msg.module = tx.transaction.msg.module;
    msg.title = tx.transaction.msg.title;
    msg.json = tx.transaction.msg.body;

    app.browser.attachMessage(msg);
    app.storage.saveMessage(tx);

  }

}




/////////////////////////////
// Display User Input Form //
/////////////////////////////
Email.prototype.displayUserInputForm = function displayUserInputForm() {

  element_to_edit = $('#module_editable_space');
  element_to_edit_html = '<input type="text" class="email_title" id="email_title" value="new email" /><p></p><textarea class="email_body" id="email_body" name="email_body"></textarea>';
  element_to_edit_css  = '<style>.email{width:100%;height:300px;padding:4px;} .email_title{margin-top:15px;width:100%;padding:5px;font-size:1.2em;} .email_body { width:100%;height:300px;font-size:1.2em;padding:5px; } </style>';

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







////////////////////////
// Format Transaction //
////////////////////////
Email.prototype.formatTransaction = function formatTransaction(tx, app) {

  // always set the message.module to the name of the app
  tx.transaction.msg.module = this.name;
  tx.transaction.msg.body  = $('#email_body').val();
  tx.transaction.msg.title  = $('#email_title').val();

  return tx;

}






//////////////////////////
// Add Message To Inbox //
//////////////////////////
Email.prototype.addMessageToInbox = function addMessageToInbox(tx, app) {

    // fetch data from app
    msg = {};
    msg.id    = tx.transaction.id;
    msg.time  = formatDate(tx.transaction.ts);
    msg.from  = tx.transaction.from[0].returnAddress();
    msg.module = tx.transaction.msg.module;
    msg.title = tx.transaction.msg.title;
    msg.json = tx.transaction.msg.body;

    app.browser.attachMessage(msg);

}





/////////////////////////
// Handle Web Requests //
/////////////////////////
Email.prototype.webServer = function webServer(app, expressapp) {


  ///////////////////
  // web resources //
  ///////////////////
  expressapp.get('/email/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/email/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });


}









formatDate = function formateDate(unixtime) {

  x = new Date(unixtime);
  return x.getDate() + " / " + (x.getMonth()+1) + " / " + x.getFullYear();

}






