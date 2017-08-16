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
  element_to_edit_html = '<div style="padding:40px;font-size:1.2em;line-height:1.8em;line-spacing:1.8m;">In addition to email, Saito supports a <a href="/twitter/" target="_twitter">Twitter-style broadcast module</a>. Since all transactions on the Saito network are included in the blockchain as normal transactions, Saito modules can build interactivity directly into the email client. When you\'re done exploring our email client, why not invite some friends to create an on-blockchain social network or learn how to code your own Saito application? <p></p><textarea class="tweet" id="tweet" name="tweet"></textarea></div>';
  element_to_edit_css  = '<style>.twitter{width:100%;height:300px;padding:4px;} .tweet { width:100%;height:300px;font-size:1.2em;padding:5px; } </style>';
  element_to_edit.html(element_to_edit_html + element_to_edit_css);

  $('.lightbox_compose_address_area').hide();


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
    msg.time   = this.formatDate(tx.transaction.ts);
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
    <div class="tweet_author">'+this.formatAuthor(msg.from, app)+'</div> \
    <div class="tweet_date">'+this.formatDate(msg.time)+'</div> \
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


  $('.add_friend').off();
  $('.add_friend').on('click', function() {

    $.fancybox({
      href            : '#lightbox_follow',
      fitToView       : false,
      width           : '300px',
      height          : '140px',
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

        $('.lightbox_follow_submit').off();
        $('.lightbox_follow_submit').on('click', function() {

	  newfriend = $('.lightbox_follow_input').val();
          app.dns.fetchRecordFromAppropriateServer(newfriend, function(answer) {

	    if (answer == "server not found") {
	      twitter_self.showBrowserAlert("To follow this account, you need to add a DNS server for their domain so we can find their public key. Alternately, just provide their public key directly in the box");
	    }
            else {
	      if (answer == "") {
	        twitter_self.showBrowserAlert("User does not exist: DNS server cannot find a record for this user");
	      } else {

	        app.friends.addFriend(answer, newfriend); 
	        app.storage.saveOptions();
	        twitter_self.showBrowserAlert("Account followed: please reload");

		$.fancybox.close();

		twitter_self.initializeHTML(app);
		twitter_self.attachEvents(app);


	        // send an email giving access
        	to = answer;
        	from = app.wallet.returnPublicKey();
        	amount = 0.0;
        	fee = 0.005;

        	server_email_html = 'You have a new follower: \
<p></p> \
The account with this public key: \
<p></p> \
'+ answer +' \
<p></p> \
Is now following your tweets on the Saito network. \
';

        	newtx = app.wallet.createUnsignedTransactionWithFee(to, amount, fee);

        	newtx.transaction.msg.module = "Email";
        	newtx.transaction.msg.body   = server_email_html;
        	newtx.transaction.msg.title  = "New Follower!";
        	newtx = app.wallet.signTransaction(newtx);


	        // because we are a server, we add this to our mempool
	        // before we send it out. This prevents the transaction
	        // from getting rejected if sent back to us and never
	        // included in a block if we are the only one handling
	        // transactions.
	        app.blockchain.mempool.addTransaction(newtx);
	        app.network.propagateTransaction(newtx);

	      }
	    }

	  });
        });
      }
    });
  });



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
      width           : '480px',
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

  $('#tweets').empty();
  $('.friendlist').empty();


  // load saved messages into twitter client
  for (yii = 0; yii < app.options.messages.length; yii++) {
    txtx = new saito.transaction(app.options.messages[yii]);
    if (txtx.transaction.msg.module != "") {
      this.addMessageToInbox(txtx, app);
    }
  }

  // if there are no saved messages, insert help message
  if (app.options.messages.length == 0) {

    // fetch data from app
    msg = {};
    msg.id     = 0;
    msg.time   = new Date().getTime();
    msg.from   = app.wallet.returnPublicKey();
    msg.module = "Twitter";
    msg.json   = "Welcome to a free-speech version of Twitter, running on the Saito blockchain. Once you add friends, their tweets will automatically load here when published to the blockchain.";

    this.attachMessage(msg, app);

  }



  // load friends into friendlist
  for (yii = 0; yii < app.options.friends.length; yii++) {
console.log("PROCESSING: "+app.options.friends[yii]);
    fhtml = '<li>'+app.options.friends[yii].identifier+'</li>';
    $('#friendlist').append(fhtml);
  }

}





Twitter.prototype.showBrowserAlert = function showBrowserAlert(message="your transasction has been broadcast to the network") {
  alert(message);
}







Twitter.prototype.formatDate = function formatDate(unixtime) {

  x = new Date(unixtime);
  y = "";
  
  if (x.getMonth()+1 == 1) { y += "Jan "; }
  if (x.getMonth()+1 == 2) { y += "Feb "; }
  if (x.getMonth()+1 == 3) { y += "Mar "; }
  if (x.getMonth()+1 == 4) { y += "Apr "; }
  if (x.getMonth()+1 == 5) { y += "May "; }
  if (x.getMonth()+1 == 6) { y += "Jun "; }
  if (x.getMonth()+1 == 7) { y += "Jul "; }
  if (x.getMonth()+1 == 8) { y += "Aug "; }
  if (x.getMonth()+1 == 9) { y += "Sept "; }
  if (x.getMonth()+1 == 10) { y += "Oct "; }
  if (x.getMonth()+1 == 11) { y += "Nov "; }
  if (x.getMonth()+1 == 12) { y += "Dec "; }
 
  y += x.getDate();

  return y;
}
Twitter.prototype.formatAuthor = function formatAuthor(author, app) {

  x = this.app.dns.returnIdentifier(author);
  if (x != "") { return x; }

  x = this.app.friends.findByPublicKey(author);
  if (x != null) { return x.publickey; }

  return (author.substring(0,10) + "...");

}






