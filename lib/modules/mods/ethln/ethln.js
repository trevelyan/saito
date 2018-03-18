var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var account = require('./account.js');



//////////////////
// CONSTRUCTOR  //
//////////////////
function Ethln(app) {

  if (!(this instanceof Ethln)) { return new Ethln(app); }

  Ethln.super_.call(this);

  this.app             = app;

  this.name            = "Ethln";
  this.browser_active  = 0;
  this.handlesEmail    = 1;
  this.emailAppName    = "Lightning Cluster";

  this.account         = null;
  this.accounts        = null;
  this.account_idx     = null;

  return this;

}
module.exports = Ethln;
util.inherits(Ethln, ModTemplate);



/////////////////////////
// Handle Web Requests //
/////////////////////////
Ethln.prototype.webServer = function webServer(app, expressapp) {

  expressapp.get('/ethln/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/ethln/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });

}




Ethln.prototype.initializeLightningCluster = function initializeLightningCluster(accounts_json=null) {

  if (this.app.options.ethereum == undefined) {
    alert("No Ethereum Keys Found: it takes about 45 seconds to initialize a Cluster. Your browser may seem to freeze -- it has not -- please wait as we generate your keypair. You will not need to do this again.");
    this.account = new account();
    this.account.initialize();
    this.app.options.ethereum = JSON.stringify(this.account.keys);
    this.app.storage.saveOptions();
  } else {
    this.account = new account();
    this.account.keys = JSON.parse(this.app.options.ethereum);
  }

}
Ethln.prototype.initializeAccounts = function initializeAccounts(accounts_json=null) {

  this.account_idx = null;

  if (accounts_json != null) {
    this.accounts = JSON.parse(accounts_json);
    for (var i = 0; i < this.accounts.length; i++) {
      if (this.accounts[i].publickey == this.account.returnPublicKey()) {
	this.account_idx = i;
      }
    }
  } else {
    this.accounts = [];
  }

}

Ethln.prototype.joinLightningCluster = function joinLightningCluster() {

  if (this.account_idx != null) { return; }

  this.account_idx = this.accounts.length;

  this.accounts[this.account_idx] = {};
  this.accounts[this.account_idx].saitokey                  = this.app.wallet.returnPublicKey();
  this.accounts[this.account_idx].publickey                 = this.account.returnPublicKey();
  this.accounts[this.account_idx].initial_coin_distribution = this.account.returnInitialCoinDistribution();
  this.accounts[this.account_idx].current_coin_distribution = this.account.returnCurrentCoinDistribution();
  this.accounts[this.account_idx].index_signed              = this.account.returnIndexSigned();
  this.accounts[this.account_idx].MRS                       = this.account.returnMRS();

}
Ethln.prototype.signLightningCluster = function signLightningCluster() {

  if (this.account_idx == null) { alert("Cannot sign Lightning Transaction"); return; }

  this.accounts[this.account_idx] = {};
  this.accounts[this.account_idx].saitokey                  = this.app.wallet.returnPublicKey();
  this.accounts[this.account_idx].publickey                 = this.account.returnPublicKey();
  this.accounts[this.account_idx].initial_coin_distribution = this.account.returnInitialCoinDistribution();
  this.accounts[this.account_idx].current_coin_distribution = this.account.returnCurrentCoinDistribution();
  this.accounts[this.account_idx].index_signed              = this.account.returnIndexSigned();
  this.accounts[this.account_idx].MRS                       = this.account.returnMRS();

}


Ethln.prototype.returnScriptInitialize = function returnScriptInitialize() {

  var output = '';

  output += '["';
  output += this.accounts.length;
  output += '",';

  for (var i = 0; i < this.accounts.length; i++) {
    output += '"0x000000000000000000000000';
    output += this.accounts[i].publickey;
    output += '", ';
  }

  for (var i = 0; i < this.accounts.length; i++) {
    if (i > 0) { output += ', '; }
    output += '"';
    output += this.accounts[i].initial_coin_distribution;
    output += '"';
  }

  output += ']';

  return output;

}
Ethln.prototype.returnScriptWithdraw = function returnScriptWithdraw() {

  var output = '';

  output += '[';

  for (var i = 0; i < this.accounts.length; i++) {
    output += '"' + this.accounts[i].current_coin_distribution + '"';
    output += ', ';
    output += '"' + this.accounts[i].current_coin_distribution + '"';
    output += ', ';
  }

  for (var i = 0; i < this.accounts.length; i++) {
    output += '"' + this.accounts[i].index_signed + '"';
    output += ', ';
  }

  for (var i = 0; i < this.accounts.length; i++) {
    if (i > 0) { output += ', '; }
    output += this.accounts[i].MRS;
  }

  output += ']';

  return output;

}


////////////////////////////////
// Email Client Interactivity //
////////////////////////////////
Ethln.prototype.displayEmailForm = function displayEmailForm(app) {

  console.log("display email FORM");

  this.initializeLightningCluster();
  this.initializeAccounts();
  this.joinLightningCluster();

  console.log("Accounts: " + JSON.stringify(this.accounts));

  element_to_edit = $('#module_editable_space');
  element_to_edit_html = '<div id="module_instructions" class="module_instructions">A Lightning Cluster lets you send and receive Ethereum off-chain using the Saito network for low-cost/free transactions. Lightning Clusters can be created with arbitrary numbers of users.</div>';
  element_to_edit.html(element_to_edit_html);

}
/////////////////////
// Display Message //
/////////////////////
Ethln.prototype.displayEmailMessage = function displayEmailMessage(message_id, app) {

  if (app.BROWSER == 1) {
    message_text_selector = "#" + message_id + " > .data";
    $('#lightbox_message_text').html( $(message_text_selector).html() );
  }

}
////////////////////////
// Format Transaction //
////////////////////////
Ethln.prototype.formatEmailTransaction = function formatEmailTransaction(tx, app) {
  tx.transaction.msg.module  = this.name;
  tx.transaction.msg.request = "ethln open request";
  tx.transaction.msg.title   = "Lightning Cluster Request";
  tx.transaction.msg.data    = JSON.stringify(this.accounts);
  return tx;
}



//////////////////
// Confirmation //
//////////////////
Ethln.prototype.onConfirmation = function onConfirmation(blk, tx, conf, app) {

  ethln_self = app.modules.returnModule("Ethln");

  // browsers check to see if the name has been registered 
  // after 1 confirmation, assuming that servers will be 
  // processing the request on the zeroth-confirmation
  if (conf == 0) {
    if (app.BROWSER == 1) {
      if (tx.isTo(app.wallet.returnPublicKey()) == 1) {
        if (tx.isFrom(app.wallet.returnPublicKey()) == 0) {

        if (tx.transaction.msg.request == "ethln open request") {
          msg                 = {};
          msg.id              = tx.transaction.id;
          msg.from            = tx.transaction.from[0].add;
          msg.time            = tx.transaction.ts;
          msg.module          = "Ethln";
          msg.title           = tx.transaction.msg.title;

          ethln_self.initializeLightningCluster();
          ethln_self.initializeAccounts(tx.transaction.msg.data);
          ethln_self.joinLightningCluster();

	  msg.data            = 'You have received a request to open a Lightning Cluster. Invited members are:<p></p>';
	  msg.data           += '<p></p>';
          msg.data	     += '<table>';
	  for (var c = 0; c < ethln_self.accounts.length; c++) {
	    msg.data	     += '<tr>';
	    msg.data         += '<td>'+ethln_self.accounts[c].saitokey+'</td>';
	    msg.data	     += '</tr>';
	  }
          msg.data	     += '</table>';
	  msg.data           += '<p></p>';
	  msg.data           += '<input type="button" id="ethln_invite" class="settings_button ethln_invite" value="invite new address" />';
	  msg.data           += '<input type="button" id="ethln_confirm" class="settings_button ethln_confirm" value="confirm and create" />';

          msg.markdown 	    = 0;

          app.modules.returnModule("Email").attachMessage(msg, app);
          app.archives.saveMessage(tx);
        }

        } // isFrom
	


        if (tx.transaction.msg.request == "ethln confirm" || tx.transaction.msg.request == "ethln update") {
          msg                 = {};
          msg.id              = tx.transaction.id;
          msg.from            = tx.transaction.from[0].add;
          msg.time            = tx.transaction.ts;
          msg.module          = "Ethln";
          msg.title           = tx.transaction.msg.title;

          ethln_self.initializeLightningCluster();
          ethln_self.initializeAccounts(tx.transaction.msg.data);

	  msg.data            = 'Your Lighting Cluster has '+ethln_self.accounts.length+' members.<p></p>';
          //for (var b = 0; b < ethln_self.accounts.length; b++) {
	  // if (b > 0) {  msg.data         += '<br />'; }
	  // msg.data         += ethln_self.accounts[b].saitokey;
          //}
          //msg.data           += '<p></p>';
          //msg.data           += 'The script used to initialze your smart contract is:<p></p>'+ethln_self.returnScriptInitialize();
	  msg.data           += '<p></p>';
	  msg.data    	     += 'Accounts and balances are: <p></p>';
          msg.data	     += '<table>';
          msg.data	     += '<tr><th>Account</th><th>Balance</th><th></th></tr>';
	  for (var c = 0; c < ethln_self.accounts.length; c++) {

	    msg.data	     += '<tr>';
	    msg.data         += '<td>'+ethln_self.accounts[c].saitokey+'</td>';
	    msg.data         += '<td>'+(ethln_self.accounts[c].current_coin_distribution/1000000000000000000)+'</td>';
	    if (ethln_self.accounts[c].saitokey == ethln_self.app.wallet.returnPublicKey()) {
	      msg.data       += '<td></td>';
	    } else {
	      msg.data       += '<td><input type="button" value="pay account" class="pay_account" id="pay_account_'+c+'" /></td>';
	    }
	    msg.data	     += '</tr>';
	  }

          msg.data	     += '</table>';

          msg.markdown 	    = 0;

          app.modules.returnModule("Email").attachMessage(msg, app);
          app.archives.saveMessage(tx);
        }

      }
    }
  }  
}




Ethln.prototype.attachEmailEvents = function attachEmailEvents(app) {

  var ethln_self = this;

  $('.pay_account').off();

  $('.pay_account').on('click', function() {

    alert("You want to pay someone. Great!");

    var payment = prompt("How much ETH would you like to transfer to this account?", "1.0");
        payment *= 1000000000000000000;

    if (payment > ethln_self.accounts[ethln_self.account_idx]) {
      alert("You do not have this amount of money in the Cluster...");
      return;
    } else {

      var attr = $(this).attr("id");
      var idx  = attr.substring(12);
      var idx_int = parseInt(idx);
     
      ethln_self.accounts[idx_int].current_coin_distribution += payment;
      ethln_self.accounts[ethln_self.account_idx].current_coin_distribution -= payment;

      var to = ethln_self.accounts[0].saitokey;

      var newtx = app.wallet.createUnsignedTransaction(to, amount, fee);
      
      newtx.transaction.msg.module   = ethln_self.name;
      newtx.transaction.msg.request  = "ethln update";
      newtx.transaction.msg.data     = JSON.stringify(ethln_self.accounts);
      newtx.transaction.msg.title    = "Lightning Cluster Payment Made";
      newtx.transaction.msg.markdown = 0;
      for (var k = 1; k < ethln_self.accounts.length; k++) {
        newtx = app.wallet.addRecipientToTransaction(newtx, ethln_self.accounts[k].saitokey);
      }
      newtx = app.wallet.signTransaction(newtx);

      // because we are a server, we add this to our mempool
      // before we send it out. This prevents the transaction
      // from getting rejected if sent back to us and never
      // included in a block if we are the only one handling
      // transactions.
      app.blockchain.mempool.addTransaction(newtx);
      app.network.propagateTransaction(newtx);

      $.fancybox.close();
    }
  });





  $('.ethln_confirm').off();
  $('.ethln_confirm').on('click', function() {

    var to = "";
    var amount = 0.0;
    var fee = 2.0;

    if (ethln_self.accounts.length < 1) { alert("Unexpected error in Lightning Cluster module"); return; }

    var newtx = app.wallet.createUnsignedTransaction(ethln_self.accounts[0].saitokey, amount, fee);
    newtx.transaction.msg.module   = ethln_self.name;
    newtx.transaction.msg.request  = "ethln confirm";
    newtx.transaction.msg.data     = JSON.stringify(ethln_self.accounts);
    newtx.transaction.msg.title    = "Lightning Cluster Created!";
    newtx.transaction.msg.markdown = 0;
    for (var k = 1; k < ethln_self.accounts.length; k++) {
      newtx = app.wallet.addRecipientToTransaction(newtx, ethln_self.accounts[k].saitokey);
    }
    newtx = app.wallet.signTransaction(newtx);

    // because we are a server, we add this to our mempool
    // before we send it out. This prevents the transaction
    // from getting rejected if sent back to us and never
    // included in a block if we are the only one handling
    // transactions.
    app.blockchain.mempool.addTransaction(newtx);
    app.network.propagateTransaction(newtx);

    $.fancybox.close();

  });







  $('.ethln_invite').off();
  $('.ethln_invite').on('click', function() {

    alert("You want to invite a third party. Great!");

    var saitoaddress = prompt("What Saito address would you like to add to this Cluster?", "");

    if (saitoaddress == "") {
      alert("Improper Address");
      return;
    } else {

alert(saitoaddress);

      var to = saitoaddress;
      var amount = 0.0;
      var fee = 2.0;

alert("1");
      var newtx = app.wallet.createUnsignedTransaction(to, amount, fee);
      newtx.transaction.msg.module   = ethln_self.name;
      newtx.transaction.msg.request  = "ethln open request";
      newtx.transaction.msg.title    = "Lightning Cluster Request";
      newtx.transaction.msg.data     = JSON.stringify(ethln_self.accounts);
      newtx.transaction.msg.markdown = 0;
      newtx                          = app.wallet.signTransaction(newtx);

alert("2");
      // because we are a server, we add this to our mempool
      // before we send it out. This prevents the transaction
      // from getting rejected if sent back to us and never
      // included in a block if we are the only one handling
      // transactions.
      app.blockchain.mempool.addTransaction(newtx);
      app.network.propagateTransaction(newtx);
alert("3");

      $.fancybox.close();
    }
  });



   







  $('.ethln_confirm').off();
  $('.ethln_confirm').on('click', function() {

    var to = "";
    var amount = 0.0;
    var fee = 2.0;

    if (ethln_self.accounts.length > 2) { alert("This button only works with two person payment"); return; }
    if (ethln_self.accounts.length < 1) { alert("Unexpected error in Lightning Cluster module"); return; }

    var newtx = app.wallet.createUnsignedTransaction(ethln_self.accounts[0].saitokey, amount, fee);
    newtx.transaction.msg.module   = ethln_self.name;
    newtx.transaction.msg.request  = "ethln confirm";
    newtx.transaction.msg.data     = JSON.stringify(ethln_self.accounts);
    newtx.transaction.msg.title    = "Lightning Cluster Created!";
    newtx.transaction.msg.markdown = 0;
    for (var k = 1; k < ethln_self.accounts.length; k++) {
      newtx = app.wallet.addRecipientToTransaction(newtx, ethln_self.accounts[k].saitokey);
    }
    newtx = app.wallet.signTransaction(newtx);

    // because we are a server, we add this to our mempool
    // before we send it out. This prevents the transaction
    // from getting rejected if sent back to us and never
    // included in a block if we are the only one handling
    // transactions.
    app.blockchain.mempool.addTransaction(newtx);
    app.network.propagateTransaction(newtx);

    $.fancybox.close();

  });

}



