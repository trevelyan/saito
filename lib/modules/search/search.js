var saito = require('../../saito');
var ModTemplate = require('../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Search(app) {

  if (!(this instanceof Search)) { return new Search(app); }
  Search.super_.call(this);

  this.app             = app;
  this.name            = "Search";

  return this;

}
module.exports = Search;
util.inherits(Search, ModTemplate);








////////////////////
// Install Module //
////////////////////
Search.prototype.installModule = function installModule() {

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_search (\
                id INTEGER, \
                from TEXT, \
                to TEXT, \
                search TEXT, \
                unixtime INTEGER, \
                PRIMARY KEY(id ASC) \
        )";

  // database reads and writes are non-blocking, so you need a callback function if you want
  // to do anything after insert. Parameters are sql query, params and the callback function
  this.app.storage.execDatabase(sql, {}, function() {});

}







/////////////////////////
// Handle Web Requests //
/////////////////////////
Search.prototype.webServer = function webServer(app, expressapp) {

  ///////////////////
  // web resources //
  ///////////////////
  expressapp.get('/search/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/search/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });

}





///////////////////
// Attach Events //
///////////////////
Search.prototype.attachEvents = function attachEvents(app) {

      search_self = this;

      $('#search_button').off();
      $('#search_button').on('click', function() {


        // search transactions are FREE but require direct connection
        // to the search engine or a proxy that offers this service.
        // the search engines themselves can decide how to manage
        // connections and payments -- it may be enough to be connected
        // to a user and process their payments to earn revenues needed
        // to operate services built atop-them.

        newtx = app.wallet.createUnsignedTransactionWithFee(search_self.app.wallet.returnPublicKey(), 0.0, 0.0);
        newtx = app.modules.formatTransaction(newtx, search_self.name);
        newtx = app.wallet.signTransaction(newtx);
        app.network.sendRequest("search", newtx.transaction);

        //search_self.showBrowserAlert("your message has been broadcast to the network");

        searchterm = $('#search_input').val();
        $('#search_logo').animate({
           marginTop: "10px"
        }, 2000, function() {
        });

      });


}


Search.prototype.initializeHTML = function initializeHTML(app) {

  this.attachEvents(app);

}



Search.prototype.showBrowserAlert = function showBrowserAlert(message="your search has been broadcast to the network") {

}

////////////////////////
// Format Transaction //
////////////////////////
Search.prototype.formatTransaction = function formatTransaction(tx, app) {

  // always set the message.module to the name of the app
  tx.transaction.msg.module     = this.name;
  tx.transaction.msg.searchterm = $('#search_input').val();
  tx.transaction.msg.results    = "";
  return tx;

}
Search.prototype.formatTransactionResponse = function formatTransactionResponse(tx, app) {

  // always set the message.module to the name of the app
  tx.transaction.msg.module     = this.name;
  tx.transaction.msg.searchterm = "";
  tx.transaction.msg.results    = this.returnSearchResults();
  return tx;

}








/////////////////////////
// Handle Peer Request //
/////////////////////////
Search.prototype.handlePeerRequest = function handlePeerRequest(app, message, peer) {

  search_self = this;

  if (message.request == "search") {
    if (message.data != null) {
      if (message.data.msg != null) {

	// servers receive results
	if (message.data.msg.results == "") {

          searchterm = message.data.msg.searchterm;

          newtx = app.wallet.createUnsignedTransactionWithFee(search_self.app.wallet.returnPublicKey(), 0.0, 0.0);
          newtx = this.formatTransactionResponse(newtx, this.name);
          newtx = app.wallet.signTransaction(newtx);
          peer.sendRequest("search_results", newtx.transaction);

        }
      }
    }
    return;
  }


  if (message.request == "search_results") {
    if (message.data != null) {
      if (message.data.msg != null) {
	if (message.data.msg.results != "") {

	  if (app.BROWSERIFY == 0) { return; }

	  search_results_html = '<ol>';

	  // create html list
	  for (vmc = 0; vmc < message.data.msg.results.length; vmc++) {
	    tmpele = '<li class="search_result" id="search_result_'+vmc+'">'+message.data.msg.results[vmc]+'</li>';
	    search_results_html += tmpele;
          }

	  search_results_html += '</ol>';

	  // display list
	  $('#search_results').html(search_results_html);

        }
      }
    }
    return;
  }





}







Search.prototype.returnSearchResults = function returnSearchResults() {

  quotes = [];

  quotes.push("A submissive sheep is a find for a wolf.");
  quotes.push("A person who is not inwardly prepared for the use of violence against him is always weaker than the person committing the violence.");
  quotes.push("The purpose of life is finding the largest burden that you can bear and bearing it.");
  quotes.push("If you are lucky enough to have lived in Paris as a young man, then wherever you go for the rest of your life, it stays with you, for Paris is a moveable feast.");
  quotes.push("Pride grows in the human heart like lard on a pig.");
  quotes.push("Only those who decline to scramble up the career ladder are interesting as human beings. Nothing is more boring than a man with a career.");
  quotes.push("Don't be afraid of misfortune, and do not yearn for happiness; it is, after all, all the same: the bitter doesn't last forever, and the sweet never fills the cup to overflowing.");
  quotes.push("Unlimited power in the hands of limited people always leads to cruelty.");
  quotes.push("The most intense patriotism always flourishes in the rear.");

  quotes.sort(function() { return 0.5 - Math.random() });

  return quotes;

}

