var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var sg = require('sendgrid')("API_KEY_HERE");
var request = sg.emptyRequest({
  method: 'POST',
  path: '/v3/mail/send',
  body: {
    personalizations: [
      {
        to: [
          {
            email: 'david@popupchinese.com'
          }
        ],
        subject: 'Saito is Email'
      }
    ],
    from: {
      email: 'saito@popupchinese.com'
    },
    content: [
      {
        type: 'text/plain',
        value: 'This email has been sent by the invitation node on the Saito Platform'
      }
    ]
  }
});





//////////////////
// CONSTRUCTOR  //
//////////////////
function Invite(app) {

  if (!(this instanceof Invite)) { return new Invite(app); }

  Invite.super_.call(this);

  this.app             = app;

  this.name            = "Invite";
  this.browser_active  = 0;
  this.handlesEmail    = 1;

  return this;

}
module.exports = Invite;
util.inherits(Invite, ModTemplate);



////////////////////
// Install Module //
////////////////////
Invite.prototype.installModule = function installModule() {

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_invite (\
                id INTEGER, \
                publickey TEXT, \
                email_to_invite TEXT, \
                unixtime INTEGER, \
                PRIMARY KEY(id ASC) \
        )";
  this.app.storage.execDatabase(sql, {}, function() {});

}




////////////////
// Initialize //
////////////////
Invite.prototype.initialize = function initialize() {

  return;

  // once the API key is provided, this will send the 
  // email specified above in the request variable
  sg.API(request, function (error, response) {
    if (error) {
      console.log('Error response received');
      console.log(error);
    }
    console.log(response.statusCode);
    console.log(response.body);
    console.log(response.headers);
  });

}




/////////////////////////
// Handle Web Requests //
/////////////////////////
Invite.prototype.webServer = function webServer(app, expressapp) {

  expressapp.get('/invite/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/invite/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });

}







////////////////////////////////
// Email Client Interactivity //
////////////////////////////////
Invite.prototype.displayEmailForm = function displayEmailForm(app) {

  element_to_edit = $('#module_editable_space');
  element_to_edit_html = '<div id="saito_instructions" class="saito_instructions" style="font-size:1.4em;line-height:1.8em;line-spacing:1.8m;">Invite a friend using an old-school email address:<p></p><input type="text" class="email_to_invite" id="email_to_invite" value="" /><p style="clear:both;margin-top:0px;"> </p><div style="font-size:0.9em">n.b: while the network is in testing we will save any email addresses submitted in order to renotify people when the network upgrades and it is necessary to re-register Saito addresses. Email addresses are being sent in cleartext until we have network-wide encryption working. This shouldn\'t be a problem, but if your friend is paranoid you can always invite using another method.</div>';
  element_to_edit_css  = '<style>.saito_instructions{width:80%;height:438px;padding:40px;font-size:1.2em;} .email_to_invite{margin-top:15px;width:200px;padding:5px;font-size:1.2em;float:left;} .saito_domain{ margin-left:5px;font-size:1.3em;font-weight:bold;padding-top:20px;padding-bottom:20px;float:left; } </style>';
  element_to_edit.html(element_to_edit_html + element_to_edit_css);

  // auto-input correct address and payment amount
  $('#lightbox_compose_to_address').val(app.wallet.returnPublicKey());
  $('#lightbox_compose_payment').val(5);
  $('.lightbox_compose_address_area').hide();
  $('.lightbox_compose_module').hide();

}
/////////////////////
// Display Message //
/////////////////////
Invite.prototype.displayEmailMessage = function displayEmailMessage(message_id, app) {

  if (app.BROWSER == 1) {

    message_text_selector = "#" + message_id + " > .data";
    $('#lightbox_message_text').html( $(message_text_selector).html() );
    $('#lightbox_compose_to_address').val(app.wallet.returnPublicKey());
    $('#lightbox_compose_payment').val(0.0);
    $('#lightbox_compose_fee').val(0.1);

  }

}
////////////////////////
// Format Transaction //
////////////////////////
Invite.prototype.formatEmailTransaction = function formatEmailTransaction(tx, app) {

  // always set the message.module to the name of the app
  tx.transaction.msg.module = this.name;
  tx.transaction.msg.email_to_invite  = $('#email_to_invite').val();
  return tx;

}









//////////////////
// Confirmation //
//////////////////
Invite.prototype.onConfirmation = function onConfirmation(tx, conf, app) {

  // we are just checking for messages that have invitations and sending
  // an email out based on that using our SendGrid account.
  if (conf == 0) {
    if (app.BROWSER == 0) {

      // save email address to database
      sql = "INSERT OR IGNORE INTO mod_invites (publickey, email_to_invite, unixtime) VALUES ($publickey, $email_to_invite, $unixtime)";
      params = { $publickey : tx.transaction.from[0].add , $email_to_invite : tx.transaction.msg.email_to_invite , $unixtime : tx.transaction.ts };
      app.storage.execDatabase(sql, params, function() {});

      to = tx.transaction.from[0].add;
      from = app.wallet.returnPublicKey();
      amount = 0.0;
      fee = 0.005;

      server_email_html = 'We have sent an invitation email to your friend, along with your public key / identifier so they know how to add you';

      newtx = app.wallet.createUnsignedTransactionWithFee(to, amount, fee);
      newtx.transaction.msg.module = "Email";
      newtx.transaction.msg.data   = server_email_html;
      newtx.transaction.msg.title  = "Invitation Sent!";
      newtx = app.wallet.signTransaction(newtx);
      app.blockchain.mempool.addTransaction(newtx);
      app.network.propagateTransaction(newtx);

    }
  }  


}















