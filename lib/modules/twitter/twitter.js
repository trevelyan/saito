var saito = require('../../saito');
var ModTemplate = require('../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Twitter(app) {

  if (!(this instanceof Twitter)) { return new Twitter(app); }
  Twitter.super_.call(this);

  this.app             = app;
  this.name            = "Twitter";
  this.supportsEmailInterface = 1;   // we have an twitter module
				     // users can publish to 
				     // twitter right in their
				     // twitter client
  return this;

}
module.exports = Twitter;
util.inherits(Twitter, ModTemplate);










////////////////////
// Install Module //
////////////////////
Twitter.prototype.installModule = function installModule() {

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_twitter (\
                id INTEGER, \
                from TEXT, \
                to TEXT, \
                tweet TEXT, \
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
Twitter.prototype.onConfirmation = function onConfirmation(tx, conf, app) {

console.log("WE HAVE RECEIVED A TWEET");

  // twitter is zero-conf
  if (conf == 0) {

    // only browsers care about posting tweets
    //if (app.BROWSERIFY == 0) { return; }

    // "this" is technically the array that calls us, so we have
    // to use a roundabout way of accessing the functions in our
    // twitter module in the onConfirmation function.
    app.modules.returnModule("Twitter").addMessageToInbox(tx, app);
    //
    app.storage.saveMessage(tx);

  }

}





////////////////////////
// Format Transaction //
////////////////////////
Twitter.prototype.formatTransaction = function formatTransaction(tx, app) {

  // always set the message.module to the name of the app
  tx.transaction.msg.module = this.name;
  tx.transaction.msg.tweet  = $('#tweet').val();

  return tx;

}






/////////////////////////////
// Display User Input Form //
/////////////////////////////
Twitter.prototype.displayUserInputForm = function displayUserInputForm(app) {

  element_to_edit = $('#module_editable_space');
  element_to_edit_html = '<textarea class="tweet" id="tweet" name="tweet"></textarea>';
  element_to_edit_css  = '<style>.twitter{width:100%;height:300px;padding:4px;} .tweet { width:100%;height:300px;font-size:1.2em;padding:5px; } </style>';
  element_to_edit.html(element_to_edit_html + element_to_edit_css);

}








//////////////////////////
// Add Message To Inbox //
//////////////////////////
//
// we repurpose this to push messages to the top of the twitter queue
//
Twitter.prototype.addMessageToInbox = function addMessageToInbox(tx, app) {

    if (app.BROWSERIFY == 0) { return; }

    // fetch data from app
    msg = {};
    msg.id     = tx.transaction.id;
    msg.time   = formatDate(tx.transaction.ts);
    msg.from   = tx.transaction.from[0].returnAddress();
    msg.module = tx.transaction.msg.module;
    msg.json   = tx.transaction.msg.tweet;

    this.attachMessage(msg, app);
}
Twitter.prototype.attachMessage = function attachMessage(msg, app) {

  if (app.BROWSERIFY == 0) { return; }

  inserthtml = '\
<div class="tweet" id="tweet_'+msg.id+'">\
  <div class="tweet_side"> \
  </div> \
  <div class="tweet_main"> \
    <div class="tweet_author">david@saito.tech</div> \
    <div class="tweet_date">Aug 14</div> \
    <div class="tweet_text">'+msg.json+'</div> \
  </div> \
  <div class="tweet_actions" id="tweet_actions"><div class="tweet_actions_reply" id="tweet_actions_reply_'+msg.id+'">reply</div><div style="display:none" id="tweet_publickey_'+msg.id+'">'+msg.from+'</div></div> \
</div>';
  $('#tweets').append(inserthtml);

  this.attachEvents(app);

}




/////////////////////////
// Handle Web Requests //
/////////////////////////
Twitter.prototype.webServer = function webServer(app, expressapp) {


  ///////////////////
  // web resources //
  ///////////////////
  expressapp.get('/twitter/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/twitter/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });


}







/////////////////
// HTML Events //
/////////////////
Twitter.prototype.attachEvents = function attachEvents(app) {

  if (app.BROWSERIFY == 0) { return; }

  twitter_self = this;


  $('.tweet_actions_reply').off();
  $('.tweet_actions_reply').on('click', function() {

    // get the public key of the tweet we are replying to
    myid = $(this).attr('id');
    myid = myid.substring(20);

    pubkeyid = "#tweet_publickey_"+myid;
    pubkey = $(pubkeyid).text();


    $.fancybox({
      href            : '#lightbox_tweet_reply',
      fitToView       : false,
      width           : '500px',
      height          : '310px',
      closeBtn        : true,
      autoSize        : false,
      closeClick      : false,
      openEffect      : 'none',
      closeEffect     : 'none',
      helpers: {
        overlay : {
          closeClick : false
        }
      },
      keys : {
        close : null
      },
      afterShow : function(){

        $('.reply').off();
        $('.reply').on('click', function() {

	  mytip = $('#lightbox_tweet_tip').val();
	  myfee = $('#lightbox_tweet_fee').val();

	  publickeyaddress = pubkey;

	  // broadcast tweet
          newtx = app.wallet.createUnsignedTransactionWithFee(publickeyaddress, mytip, myfee);
          newtx = twitter_self.formatTransaction(newtx, app);
          newtx = app.wallet.signTransaction(newtx);
          app.network.propagateTransaction(newtx);
          twitter_self.showBrowserAlert("your message has been broadcast to the network");

          $.fancybox.close();

	});

      }
    });

  });

}



Twitter.prototype.initializeHTML = function initializeHTML(app) {



  // load saved messages into twitter client
console.log("LOADING SAVED MESSAGES INTO CLIENT: ");
  for (yii = 0; yii < app.options.messages.length; yii++) {
console.log("FETCHING TX:");
    txtx = new saito.transaction(app.options.messages[yii]);
console.log(txtx);    
    //$('#debug').text(app.options.messages[yii]);
console.log("TESTING HERE " + txtx.transaction.msg.module);
    if (txtx.transaction.msg.module != "") {
console.log("ADDING: " + txtx);
      this.addMessageToInbox(txtx, app);
    }
  }

}





Twitter.prototype.showBrowserAlert = function showBrowserAlert(message="your transasction has been broadcast to the network") {
  alert(message);
}







formatDate = function formateDate(unixtime) {

  x = new Date(unixtime);
  return x.getDate() + " / " + (x.getMonth()+1) + " / " + x.getFullYear();

}






