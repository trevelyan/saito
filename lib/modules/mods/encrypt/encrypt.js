var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Encrypt(app) {

  if (!(this instanceof Encrypt)) { return new Encrypt(app); }

  Encrypt.super_.call(this);

  this.app             = app;

  this.name            = "Encrypt";
  this.handlesEmail    = 1;
  this.emailAppName    = "Encryption";

  this.email_view_txid = 0;

  return this;

}
module.exports = Encrypt;
util.inherits(Encrypt, ModTemplate);




/////////////////////
// Email Functions //
/////////////////////
Encrypt.prototype.displayEmailForm = function displayEmailForm(app) {

  element_to_edit = $('#module_editable_space');
  element_to_edit.html('<div class="module_instructions">Click send to initiate a Diffie-Hellman key-exchange over the Saito blockchain. Once your recipient approves your request, you will be notified and all subsequent email with them will be automatically encrypted.</div>');
}
Encrypt.prototype.formatEmailTransaction = function formatEmailTransaction(tx, app) {

  link_id    = "encrypt_authorize_link_"+this.email_view_txid;

  // always set the message.module to the name of the app
  tx.transaction.msg.module  = this.name;
  tx.transaction.msg.request = "key exchange request";
  tx.transaction.msg.title   = "Key-Exchange Request";
  email_html = 'You have received a request for encrypted communications from the sender of this email.<p></p>To authorize this request, <div class="encrypt_authorize_link" id="'+link_id+'" style="display:inline;text-decoration:underline;cursor:pointer">click here</div>.';
  tx.transaction.msg.data    = email_html;

  // return OUR public key submitting THEIR publickey
  tx.transaction.msg.alice_publickey = app.keys.initializeKeyExchange(tx.transaction.to[0].add);

console.log("\nINITIALIZED ALICE WITH PUBLICKEY: ");
console.log(tx.transaction.msg.alice_publickey);

  return tx;

}
Encrypt.prototype.displayEmailMessage = function displayEmailMessage(message_id, app) {

  if (app.BROWSER == 1) {
    this.email_view_txid = message_id.substring(8);
    message_text_selector = "#" + message_id + " > .data";
    authbody = $(message_text_selector).html();

    $('#lightbox_message_text').html(authbody);

    // update authorize link ID
    message_text_selector = ".lightbox_message_text > .encrypt_authorize_link";
    new_auth_link = "encrypt_authorize_link_"+this.email_view_txid;
    $(message_text_selector).attr('id', new_auth_link);
  }

}










//////////////////
// Confirmation //
//////////////////
Encrypt.prototype.onConfirmation = function onConfirmation(blk, tx, conf, app) {

  if (conf == 0) {

    var sender           = tx.transaction.from[0].add;
    var receiver         = tx.transaction.to[0].add;
    var request          = tx.transaction.msg.request;  // "request"

    /////////////////////////
    // requests made to us //
    /////////////////////////
    if (receiver == app.wallet.returnPublicKey()) {

      // someone wants to key exchange
      if (tx.transaction.msg.request == "key exchange request") {

        msg                 = {};
        msg.id              = tx.transaction.id;
        msg.from            = sender;
        msg.time            = tx.transaction.ts;
        msg.module          = "Encrypt";
        msg.title           = tx.transaction.msg.title;
        msg.data            = tx.transaction.msg.data;;
        msg.alice_publickey = tx.transaction.msg.alice_publickey;
	msg.markdown = 0;

        app.modules.returnModule("Email").attachMessage(msg, app, 0);
        app.archives.saveMessage(tx);

      }


      // confirming shared secret
      if (tx.transaction.msg.request == "key exchange confirm") {

        msg        = {};
        msg.id     = tx.transaction.id;
        msg.from   = sender;
        msg.time   = tx.transaction.ts;
        msg.module = "Encrypt";
        msg.title  = tx.transaction.msg.title;
        msg.data   = tx.transaction.msg.data;       
        msg.markdown = 0;

	// generate the shared secret
	var bob_publickey = new Buffer(tx.transaction.msg.bob, "hex");;

	var senderkeydata = app.keys.findByPublicKey(sender);

	if (senderkeydata == null) { if (app.BROWSER == 1) { alert('Cannot find our original DH keys for key exchange.'); return; } }

	var alice_publickey  = new Buffer(senderkeydata.aes_publickey, "hex");
	var alice_privatekey = new Buffer(senderkeydata.aes_privatekey, "hex");

	var alice            = app.crypt.createDiffieHellman(alice_publickey, alice_privatekey);
        var alice_secret     = app.crypt.createDiffieHellmanSecret(alice, bob_publickey);

        app.keys.updateCryptoByPublicKey(sender, alice_publickey.toString("hex"), alice_privatekey.toString("hex"), alice_secret.toString("hex"));

        app.modules.returnModule("Email").attachMessage(msg, app, 0);
        app.archives.saveMessage(tx);

      }
    }
  }
}






Encrypt.prototype.attachEmailEvents = function attachEmailEvents(app) {

  if (app.BROWSER == 1) {

    // fancybox does not want us to attach events by #id so we
    // have to handle it by class. This is a bug in their software
    $('.encrypt_authorize_link').off();
    $('.encrypt_authorize_link').on('click', function() {

      txid = $(this).attr('id');
      txid = txid.substring(23);

      thistx = app.archives.returnTransactionById(txid);

      if (thistx == null) { return; }

      remote_address = thistx.transaction.from[0].add;
      our_address    = thistx.transaction.to[0].add;
      alice_publickey = thistx.transaction.msg.alice_publickey;

      // generate shared secret and save
      bob              = app.crypt.createDiffieHellman();
      bob_publickey    = bob.getPublicKey(null, "compressed").toString("hex");
      bob_privatekey   = bob.getPrivateKey(null, "compressed").toString("hex");
      bob_secret       = app.crypt.createDiffieHellmanSecret(bob, new Buffer(alice_publickey, "hex"));

      // send plaintext confirmation, returning publickey used for encryption
      email_html = 'Your request for encrypted communications has been accepted by: <p></p>'+app.modules.returnModule("Email").formatAuthor(our_address, app)+'<p></p>Your future correspondence will be encrypted with a shared-secret known only by your two accounts.';

      newtx = app.wallet.createUnsignedTransaction(remote_address, 1.5, 2.0);
      if (newtx == null) { return; }
      newtx.transaction.msg.module  = "Encrypt";
      newtx.transaction.msg.request = "key exchange confirm";
      newtx.transaction.msg.tx_id   = txid;		// reference id for parent tx
      newtx.transaction.msg.title   = "Key-Exchange Success";
      newtx.transaction.msg.data    = email_html;
      newtx.transaction.msg.bob     = bob_publickey;
      newtx = app.wallet.signTransaction(newtx);

      app.blockchain.mempool.addTransaction(newtx);
      app.network.propagateTransaction(newtx);

      $.fancybox.close();

      // save encryption information
      app.keys.updateCryptoByPublicKey(thistx.transaction.from[0].add, bob_publickey, bob_privatekey, bob_secret.toString("hex"));
      app.modules.returnModule("Email").showBrowserAlert("key-exchange completed");

    });
  }
}






