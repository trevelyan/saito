var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Facebook(app) {

  if (!(this instanceof Facebook)) { return new Facebook(app); }

  Facebook.super_.call(this);

  this.app               = app;

  this.name              = "Facebook";

  this.facebook          = {};
  this.facebook.firehose = 1;   // do I want ALL posts
				//
				// 1 = show me everything
				// 0 = only who i follow

  this.facebook.filter   = 0;   // do I want ALL comments
				//
				// 0 = show all comments
				// 1 = only comments from ppl I follow

  this.browser_active    = 0;
  this.mylastposttime    = 0;
  this.mylastcommenttime = 0;

  return this;

}
module.exports = Facebook;
util.inherits(Facebook, ModTemplate);








////////////////
// Initialize //
////////////////
Facebook.prototype.initialize = function initialize() {

  if (this.browser_active == 0) { return; }

  if (this.app.BROWSER == 1) {

    var facebook_self = this;
/***
    if (facebook_self.facebook.firehose == 1) {
      var fbloadtimer = setTimeout(function() {
        // request we get the last X posts if we are
        // listening to the entire Internet. This just
        // makes sure the app is usable for new peopl
        message                 = {};
        message.request         = "facebook load request";
        message.data            = {};
        message.data.request    = "facebook load request";
        facebook_self.app.network.sendRequest(message.request, message.data);
        console.log("\n\nWE HAVE JUST SENT THE REQUEST TO THE SERVER TO LOAD OUR FACEBOOK POSTS\n\n");

      }, 1500);

    }
***/

  }

}


////////////////////
// Install Module //
////////////////////
Facebook.prototype.installModule = function installModule() {

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_facebook (\
                id INTEGER, \
                tx TEXT, \
                unixtime INTEGER, \
                PRIMARY KEY(id ASC) \
        )";
  this.app.storage.execDatabase(sql, {}, function() {});

}


// we save the latest 2 POSTS by default -- so we can populate new
// browsers with some shared content on-connect. This is just a 
// usability hack so that the social network won't seem entirely
// dead.
Facebook.prototype.saveFacebookPost = function saveFacebookPost(tx) {

  var facebook_self = this;

  var sql = "INSERT OR IGNORE INTO mod_facebook (tx, unixtime) VALUES ($tx, $unixtime)";
  facebook_self.app.storage.queryDatabase(sql, {
    $tx: JSON.stringify(tx.transaction),
    $unixtime: tx.transaction.ts
  }, function(err, row) {
    var sql2 = "select count(*) as count, max(id) as max_id from mod_facebook";
    facebook_self.app.storage.queryDatabase(sql2, {}, function(err, row) {
      if (row != null) {
        if (row.count > 0) {
          if (row.count > 2) {
	    var min_id = row.max_id - 2;
    	    sql3 = "DELETE FROM mod_facebook WHERE id <= $min_id";
  	    facebook_self.app.storage.queryDatabase(sql3, {
		$min_id: min_id
  	    }, function(err, row) {});
          }
        } else {
        }
      }
    });
  });

}









// handle options, force minimal preferences saved to wallet
Facebook.prototype.saveFacebook = function saveFacebook(app) {
  app.options.facebook = this.facebook;
  app.storage.saveOptions();
}
Facebook.prototype.updateFilter = function updateFilter(nf) {
  this.facebook.filter = nf;
  this.saveFacebook();
}
Facebook.prototype.updateFirehose = function updateFirehose(nf) {
  this.facebook.firehose = nf;
  this.saveFacebook();
}



Facebook.prototype.initializeHTML = function initializeHTML(app) {

  if (app.BROWSER == 0) { return; }

  // update name
  if (app.wallet.returnIdentifier() != "") {
    $('#saitoname').text(app.wallet.returnIdentifier());
  } else {
    $('#saitoname').text(this.formatAuthor(app.wallet.returnPublicKey()));
  }

  // update firehost and filter variables
  if (app.options.facebook != null) {
    this.facebook.firehose = app.options.facebook.firehose;
    this.facebook.filter   = app.options.facebook.filter;
    $('#post_options_select_firehose').val(this.facebook.firehose);
    $('#post_options_select_filter').val(this.facebook.filter);
  }





/************
  // check to make sure we have an identifier
  if (app.wallet.returnIdentifier() == "") {

    $.fancybox({
      href            : '#lightbox_identifier_missing',
      fitToView       : false,
      width           : '600px',
      height          : '440px',
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
      }
    });
  }
************/


  if ($('#post_box_0').length == 0) {
    msg = {};
    msg.id     = "0";
    msg.time   = "Aug 17, 2017";
    msg.from   = "david@satoshi";
    msg.module = "Facebook";
    msg.title  = "Hello World";
    msg.data   = "It would be hard to identify the exact source of that inner intuition, not founded on rational argument, which prompted our refusal to enter the NKVD schools. It certainly didn't derive from the lectures on historical materialism we listened to: it was clear from them that the struggle against the internal enemy was a crucial battlefront, and to share in it was an honorable task. Our decision even ran counter to our material interests: at that time the provincial university we attended could not promise us anything more than the chance to teach in a rural school in a remote area for miserly wages. The NKVD school dangled before us special rations and double or triple pay. Our feelings could not be put into words—and even if we had found the words, fear would have prevented our speaking them aloud to one another. It was not our minds that resisted but something inside our breasts. People can shout at you from all sides: \"You must!\" And your own head can be saying also: \"You must!\" But inside your breast there is a sense of revulsion, repudiation. I don't want to. It makes me feel sick. Do what you want without me; I want no part of it.<p></p> -- Alexander Solzhenitsyn";
    this.attachMessage(msg, app, 1);
  }


  var facebook_self = this;
  app.archives.processMessages(20, function (err, txarray) {
    for (bv = 0; bv < txarray.length; bv++) {
      if (txarray[bv].transaction.msg.type == "post") {
        facebook_self.addPostToWall(txarray[bv], app, 1);
      }
      if (txarray[bv].transaction.msg.type == "comment") {
        facebook_self.addCommentToPost(txarray[bv], app, 0);
      }
    }
  });


  // update friend list
  $("#following_friends_box").empty();
  facebook_friends = this.app.keys.returnKeywordArray("Facebook");
  for (ff = 0; ff < facebook_friends.length; ff++) {
    thisfriend = '<div id="following_'+ff+'" class="following_friend">' + facebook_friends[ff].identifier + '</div>';
    $("#following_friends_box").append(thisfriend);
  }


  // update account balance
  this.updateBalance(this.app);


  // update keys to names with DNS check
  //
  // check DNS on timeout so our network
  // has time to bootstrap and fetch 
  // public keys, etc.
  // 
  // run 2 seconds after page launch
  setTimeout(function() {

    keystocheck = [];

    $('.comment_name').each(function() {
      commentname = $(this).text();
      publickey  = $(this).prev().text();
      if (commentname.indexOf("...") > 0) {
        updateme = 1;
        for (m = 0; m < keystocheck.length; m++) {
          if (keystocheck[m] == publickey) { updateme = 0; m = keystocheck.length; }
        }
        if (updateme == 1) {
          keystocheck.push(publickey);
        }
      }
    });
    $('.post_header_name').each(function() {
      commentname = $(this).text();
      publickey  = $(this).next().next().text();
      if (commentname.indexOf("...") > 0) {
        updateme = 1;
        for (m = 0; m < keystocheck.length; m++) {
          if (keystocheck[m] == publickey) { updateme = 0; m = keystocheck.length; }
        }
        if (updateme == 1) {
          keystocheck.push(publickey);
        }
      }
    });

    for (cfg = 0; cfg < keystocheck.length; cfg++) {

      thispublickey = keystocheck[cfg];   

      // fetch the ID for this KEY and update if FOUND
      app.dns.fetchIdFromAppropriateServer(thispublickey, function(answer) {

	dns_response = JSON.parse(answer);
	if (dns_response.err != "") {
	  console.log(dns_response.err);
	  return;
	} else {

	  myidentifier = dns_response.identifier;
	  mypublickey = dns_response.publickey;

          $('.comment_name').each(function() {
            commentname2 = $(this).text();
            publickey2  = $(this).prev().text();
            if (publickey2 === mypublickey) { $(this).text(myidentifier); }
          });
          $('.post_header_name').each(function() {
            commentname2 = $(this).text();
            publickey2  = $(this).next().next().text();
            if (publickey2 === mypublickey) { $(this).text(myidentifier); }
	  });
	}
      });
    }
  }, 2000);

}


//////////////////////
// Add Post to Wall //
//////////////////////
Facebook.prototype.addCommentToPost = function addCommentToPost(tx, app, prepend = 0) {

  if (app.BROWSER == 0) { return; }

  // fetch data from tx
  var msg = {};
  msg.id      = tx.transaction.id;
  msg.time    = tx.transaction.ts;
  msg.from    = tx.transaction.from[0].add;
  msg.module  = tx.transaction.msg.module;
  msg.data    = tx.transaction.msg.data;
  msg.type    = tx.transaction.msg.type;
  msg.post_id = tx.transaction.msg.post_id;

  // if this is a comment that we have already added because
  // it is ours and we posted it to the wall on create then
  // update the ID attributes so that we can attach events
  // and treat it as a normal comment hereafter.
  if (msg.from == app.wallet.returnPublicKey()) {
    if (msg.time == this.mylastcommenttime) {
      var tmpcomment_selector  = "#comment_1";

      // comment_box_id
      tmpcomment_update_id = "comment_"+msg.id;
      $(tmpcomment_selector).attr('id',tmpcomment_update_id);

      console.log("NOT ADDING COMMENT: would be repost");
      return;
    }

    this.mylastcommenttime = msg.time;

  } else {
    tocheck = "#comment_"+msg.id;
    if ($(tocheck).length > 0) { 
      console.log("COMMENT ALREADY FOUND -- not adding");
      return; 
    }
  }

  this.attachComment(msg, app, prepend);

}
Facebook.prototype.addPostToWall = function addPostToWall(tx, app, prepend = 0) {

  if (app.BROWSER == 0) { return; }

    // fetch data from tx
    msg = {};
    msg.id     = tx.transaction.id;
    msg.time   = tx.transaction.ts;


    if (tx.transaction.from == null) { 
      alert("Your account balance is currently zero");
      return;
    }

    msg.from   = tx.transaction.from[0].add;
    msg.module = tx.transaction.msg.module;
    msg.type   = tx.transaction.msg.type;
    msg.data   = tx.transaction.msg.data;


    // if we already have a post with this ID then 
    // it is probably a confirmation of a post we have
    // already added getting re-added on page reload, 
    // so ignore.
    tmpselector = "#post_box_"+msg.id;
    if ($(tmpselector).length > 0) { return; }


    // used when we recreate a post in order to save
    // it even though we were not listening at the
    // time. in these cases we save a zero-fee transactions
    // and have a special field tagging the original
    // sender
    if (tx.transaction.msg.poster_address != null) {
      msg.from = tx.transaction.msg.poster_address;
      msg.id   = tx.transaction.msg.post_id;
    }





    // if this is a post that we have already added because
    // it is ours and we posted it to the wall on create then
    // update the ID attributes so that we can attach events
    // and treat it as a normal post hereafter.
    if (msg.from == app.wallet.returnPublicKey()) {
      if (msg.time == this.mylastposttime) {
	tmppost_selector  = "#post_box_1";

        // post_box_id
	tmppost_update_id = "post_box_"+msg.id;
	$(tmppost_selector).attr('id',tmppost_update_id);

        // post_box_controls
        tmpidupdate = "post_controls_like_"+msg.id;
        $('#post_controls_like_1').attr('id',tmpidupdate);

        tmpidupdate = "post_controls_share_"+msg.id;
        $('#post_controls_share_1').attr('id',tmpidupdate);

        tmpidupdate = "post_controls_comment_"+msg.id;
        $('#post_controls_comment_1').attr('id',tmpidupdate);

        // enable comments, etc. now
        this.attachEvents(app);

	return;
      }
      this.mylastposttime = msg.time;
    } else {
      tocheck = "#post_box_"+tx.transaction.id;
      if ($(tocheck).length > 0) { 
	//console.log("POST ALREADY FOUND -- not adding");
	return; 
      }
    }



    this.attachMessage(msg, app, prepend);

}
Facebook.prototype.formatComment = function formatComment(msg, app) {
  return '\
  <div class="comment" id="comment_'+msg.id+'"> \
    <table><tr><td valign="top"><div class="post_comment_avatar load_information"></div></td><td valign="top"><div class="comment_address">'+msg.from+'</div><div class="comment_name" id="comment_name_'+msg.id+'">'+this.formatAuthor(msg.from, app, msg)+'</div> - <div class="comment_text">'+msg.data+'</div></td></tr></table> \
  </div> \
';
}
Facebook.prototype.formatNewPost = function formatNewPost(app) {
  return '\
<div class="post_box" id="post_box_create">\
  <div class="post_header"> \
    <div class="post_header_avatar load_information"> \
    </div> \
    <div class="post_header_titlebox"> \
      <div class="post_header_name">'+this.formatAuthor(app.wallet.returnPublicKey(), app)+'</div> \
      <div class="post_header_date">'+this.formatDate(new Date().getTime())+'</div> \
    </div> \
  </div> \
  <div class="post_create"><textarea id="post_create_textarea" class="post_create_textarea"></textarea></div> \
  <div class="facebook_button publish_button" id="publish_button" alt="publish"><i class="fa fa-upload"></i> <div class="post_controls_label">PUBLISH</div></div> \
</div> \
';
}
Facebook.prototype.formatPost = function formatPost(msg, app) {
  return '\
<div class="post_box" id="post_box_'+msg.id+'">\
  <div class="post_header"> \
    <div class="post_header_avatar load_information"> \
    </div> \
    <div class="post_header_titlebox"> \
      <div class="post_header_name">'+this.formatAuthor(msg.from, app, msg)+'</div> \
      <div class="post_header_date">'+this.formatDate(msg.time)+'</div> \
      <div class="post_header_address">'+msg.from+'</div> \
    </div> \
  </div> \
  <div class="post_content">'+msg.data.replace(/\n\n/g, "<p></p>")+'</div> \
  <div class="post_controls"> \
    <div id="post_controls_delete_'+msg.id+'" class="post_controls_item post_controls_delete" alt="delete"><i class="fa fa-trash-o"></i> <div class="post_controls_label">DELETE</div></div> \
    <div id="post_controls_comment_'+msg.id+'" class="post_controls_item post_controls_comment" alt="comment"><i class="fa fa-comment-o"></i> <div class="post_controls_label">COMMENT</div></div> \
    <div id="post_controls_share_'+msg.id+'" class="post_controls_item post_controls_share" alt="share"><i class="fa fa-share-alt"></i> <div class="post_controls_label">SHARE</div></div> \
  </div> \
  <div class="post_commentbox"> \
    <div class="post_comments"> \
    </div> \
    <div class="post_comments_create"> \
    </div> \
  </div> \
</div> \
';
}
Facebook.prototype.formatNewComment = function formatNewComment(msg, app) {
  return '\
  <textarea id="post_comments_create_textarea" class="post_comments_create_textarea"></textarea> \
  <div class="facebook_button post_comments_button" id="comment_button_'+msg.id+'" alt="publish"><i class="fa fa-upload"></i> <div class="post_controls_label">LEAVE COMMENT</div></div> \
';
}

Facebook.prototype.attachComment = function attachComment(msg, app, prepend = 0) {

  // exit if comment already exists (i.e. on page reload)
  var tmp_comment_id = "#comment_"+msg.id;
  if ($(tmp_comment_id).length > 0) { return; }

  cbsel = "#post_box_" + msg.post_id + " > .post_commentbox > .post_comments";
  if (prepend == 0) {
    $(cbsel).append(this.formatComment(msg, app));
  } else {
    $(cbsel).prepend(this.formatComment(msg, app));
  }
  this.attachEvents(app);
}
Facebook.prototype.attachMessage = function attachMessage(msg, app, prepend = 0) {

  // exit if post already exists (i.e. on page reload)
  var tmp_post_id = "#post_box_"+msg.id;
  if ($(tmp_post_id).length > 0) { return; }

  if (prepend == 0) {
    $('#posts').append(this.formatPost(msg, app));
  } else {
    $('#posts').prepend(this.formatPost(msg, app));
  }
  this.attachEvents(app);
}
Facebook.prototype.attachEventStubs = function attachEventStubs(app) {

  var facebook_self = this;

  tmpselector = "#post_box_1 .post_controls > .post_controls_like";
  $(tmpselector).off();
  $(tmpselector).on('click', function() {
    alert("Please wait for a single confirmation before attempting to like your new post");
  });

  tmpselector = "#post_box_1 .post_controls > .post_controls_comment";
  $(tmpselector).off();
  $(tmpselector).on('click', function() {
    alert("Please wait for a single confirmation before attempting to comment on your new post");
  });

  tmpselector = "#post_box_1 .post_controls > .post_controls_share";
  $(tmpselector).off();
  $(tmpselector).on('click', function() {
    alert("Please wait for a single confirmation before attempting to share your new post");
  });

  tmpselector = "#post_box_1 .post_controls > .post_controls_delete";
  $(tmpselector).off();
  $(tmpselector).on('click', function() {
    alert("Please wait for a single confirmation before attempting to delete your new post");
  });

}
Facebook.prototype.attachEvents = function attachEvents(app) {

  var facebook_self = this;

  $('.following_friend').off();
  $('.following_friend').on('click', function() {
    var purgeuser = confirm("Do you want to unfollow this user?");
    if (purgeuser) {
      identifier = $(this).text(); 
      // purge user with key
      app.keys.removeKeyByIdentifierAndKeyword(identifier, "Facebook");
      app.keys.saveKeys();
      facebook_self.showBrowserAlert("Account Unfollowed");
      facebook_self.initializeHTML(app);
      facebook_self.attachEvents(app);
    }
  });

  $('.post_header_name').off();
  $('.post_header_name').on('click', function() {
    var addthisuser = confirm("Do you want to follow this user?");
    if (addthisuser) {
      identifier = $(this).text(); 
      publickey  = $(this).next().next().text(); 
      // follow user with key
      app.keys.addKey(publickey, identifier, 1, "Facebook");
      app.keys.saveKeys();
      facebook_self.showBrowserAlert("Account Followed");
      facebook_self.initializeHTML(app);
      facebook_self.attachEvents(app);
    }
  });

  $('.comment_name').off();
  $('.comment_name').on('click', function() {
    var addthisuser = confirm("Do you want to follow this user?");
    if (addthisuser) {
      identifier = $(this).text();
      publickey  = $(this).prev().text();
      app.keys.addKey(publickey, identifier, 1, "Facebook");
      app.keys.saveKeys();
      facebook_self.showBrowserAlert("Account Followed");
      facebook_self.initializeHTML(app);
      facebook_self.attachEvents(app);
    }
  });


  $('#settings').off();
  $('#settings').on('click', function() {

    $.fancybox({
      href            : '#lightbox_settings',
      fitToView       : false,
      width           : '260px',
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
      }
    });

  });


  $('#post_options_select_firehose').off();
  $('#post_options_select_firehose').on('click', function() {
    newval = $(this).val();
    facebook_self.facebook.firehose = newval;
    facebook_self.saveFacebook(facebook_self.app);
  });


  $('#post_options_select_filter').off();
  $('#post_options_select_filter').on('click', function() {
    newval = $(this).val();
    facebook_self.facebook.filter = newval;
    facebook_self.saveFacebook(facebook_self.app);
  });


  $('.load_information').off();
  $('.load_information').on('click', function() {

    $.fancybox({
      href            : '#lightbox_information',
      fitToView       : false,
      width           : '600px',
      height          : '440px',
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
      }
    });
  });


  $('#add_friend').off();
  $('#add_friend').on('click', function() {

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
	  if (facebook_self.isPublicKey(newfriend) == 1) {

		  // if the user entered a publickey as the 
		  // friend value, we create an abridged version
		  // of it to server as the identifier and add
		  // it to the keylist.
		  answer = newfriend.substring(0,12) + "...";

	  	  // add them
                  app.keys.addKey(newfriend, answer, 1, "Facebook");
		  app.keys.saveKeys();

                  facebook_self.showBrowserAlert("Account Followed");

                  $.fancybox.close();

                  facebook_self.initializeHTML(app);
                  facebook_self.attachEvents(app);

	  } else {


	    // if the user submitted an address, we check our
	    // DNS server for the record and add the account 
	    // if we can find it.
            app.dns.fetchRecordFromAppropriateServer(newfriend, function(answer) {

	      dns_response = JSON.parse(answer);

              if (dns_response.err != "") {
                facebook_self.showBrowserAlert("Error: "+dns_response.err);
	        return;
	      } else {

	  	// add them
                app.keys.addKey(dns_response.publickey, newfriend, 1, "Facebook");
		app.keys.saveKeys();

                facebook_self.showBrowserAlert("Account Followed");

                $.fancybox.close();

                facebook_self.initializeHTML(app);
                facebook_self.attachEvents(app);

                // send an email to the recipient
                to = dns_response.publickey;
                from = app.wallet.returnPublicKey();
                amount = 0.0;
                fee = 2.0;

                server_email_html = 'You have a new follower: \
<p></p> \
'+ dns_response.identifier +' \
<br /> \
'+ dns_response.publickey +' \
<p></p> \
Is now following your broadcast messages on the Saito network. \
';
                var newtx = app.wallet.createUnsignedTransactionWithFee(to, amount, fee);
    		if (newtx == null) { return; }
                newtx.transaction.msg.module = "Email";
                newtx.transaction.msg.data   = server_email_html;
                newtx.transaction.msg.title  = "New Follower!";
                newtx = app.wallet.signTransaction(newtx);
                app.blockchain.mempool.addTransaction(newtx);
                app.network.propagateTransaction(newtx);
		app.storage.saveOptions();

              }
            });
          }
        });
      }
    });
  });


  $('#publish_button').off('click');
  $('#publish_button').on('click', function() {

    if (facebook_self.app.network.isConnected() == 0) {
      alert("Browser lost connection to network: post not sent...");
      return;
    };

    tmppost = $('#post_create_textarea').val();
    publickeyaddress = app.wallet.returnPublicKey();
    amount = 0.0;
    fee = 2.0;

    var newtx = app.wallet.createUnsignedTransactionWithFee(publickeyaddress, amount, fee);
    if (newtx == null) { return; }
    newtx.transaction.msg.module = "Facebook";
    newtx.transaction.msg.data   = tmppost;
    newtx.transaction.msg.type   = "post";
    newtx = app.wallet.signTransaction(newtx);
    app.network.propagateTransaction(newtx);
    app.storage.saveOptions();

    facebook_self.addPostToWall(newtx, app, 1);

    $('#post_box_create').remove();

    facebook_self.attachEventStubs(app);

  });


  $('#new_post').off('click');
  $('#new_post').on('click', function() {
    $('#posts').prepend(facebook_self.formatNewPost(app));
    $('#post_create_textarea').focus();
    facebook_self.attachEvents(app);
  });


  $('.post_controls_like').off('click');
  $('.post_controls_like').on('click', function() {
     id = $(this).attr('id');
     msgid = id.substring(19);

     publickey_selector = "#post_box_" + msg.id + " > .post_header > .post_header_titlebox > .post_header_address";
     publickeyaddress = $(publickey_selector).text();
     amount = 0.0;
     fee = 2;

     iam = facebook_self.app.wallet.returnIdentifier();
     if (iam == "") { iam = facebook_self.app.wallet.returnPublicKey().substring(0, 20) + "..."; }
     like_email = iam + ' liked your post';

     var newtx = app.wallet.createUnsignedTransactionWithFee(publickeyaddress, amount, fee);
     if (newtx == null) { return; }
     newtx.transaction.msg.module  = "Email";
     newtx.transaction.msg.data    = like_email;
     newtx.transaction.msg.title   = like_email;
     newtx = app.wallet.signTransaction(newtx);
     app.network.propagateTransaction(newtx);
     app.storage.saveOptions();
     alert("You liked this Post");
   });



  $('.post_controls_comment').off('click');
  $('.post_controls_comment').on('click', function() {

     id = $(this).attr('id');
     msg = {}; msg.id = id.substring(22);
     pcc = facebook_self.formatNewComment(msg,app);
     
     tmpselector  = "#post_box_" + msg.id + " > .post_commentbox > .post_comments_create";
     $('.post_comments_create').hide();
     $('.post_comments_create').empty();
     $(tmpselector).html(pcc);
     $(tmpselector).slideDown();
     facebook_self.attachEvents(app);

     // scroll to comment box
     //$('html, body').animate({
     //   scrollTop: $(".post_comments_create").offset().top
     //}, 2000);

   });


   $('.post_comments_button').off('click');
   $('.post_comments_button').on('click', function() {

      if (facebook_self.app.network.isConnected() == 0) {
        alert("Browser lost connection to network: post not sent...");
        return;
      };

     var id = $(this).attr('id');
     var msg = {}; msg.id = id.substring(15);
     var tmpcomment = $('#post_comments_create_textarea').val();

     publickey_selector = "#post_box_" + msg.id + " > .post_header > .post_header_titlebox > .post_header_address";
     publickeyaddress = $(publickey_selector).text();
     amount = 0.0;
     fee = 2;

     var newtx = app.wallet.createUnsignedTransactionWithFee(publickeyaddress, amount, fee);
     if (newtx == null) { return; }
     newtx.transaction.msg.module  = "Facebook";
     newtx.transaction.msg.type    = "comment";
     newtx.transaction.msg.data    = tmpcomment;
     newtx.transaction.msg.post_id = msg.id;
     newtx = app.wallet.signTransaction(newtx);
     app.network.propagateTransaction(newtx);
     app.storage.saveOptions();
     facebook_self.addCommentToPost(newtx, app, 0);
     $('.post_comments_create').slideUp().empty();

     facebook_self.attachEventStubs(app);

   });

   $('.post_controls_delete').off('click');
   $('.post_controls_delete').on('click', function() {

     var id = $(this).attr('id');
     var msgid = id.substring(21);

     var tmpselector  = "#post_box_" + msgid;
     $(tmpselector).remove();
     facebook_self.app.archives.removeMessage(msgid);

     alert("deleted post");
   });



   $('.post_controls_share').off('click');
   $('.post_controls_share').on('click', function() {

     if (facebook_self.app.network.isConnected() == 0) {
        alert("Browser lost connection to network: post not shared...");
        return;
     };

     id = $(this).attr('id');
     msgid = id.substring(20);

     postauthorid = '';
     postauthorpk = '';
     postbody = '';

     tmpselector  = "#post_box_" + msg.id + " > .post_header > .post_header_titlebox > .post_header_address";
     postauthorpk = $(tmpselector).text();

     tmpselector  = "#post_box_" + msg.id + " > .post_header > .post_header_titlebox > .post_header_name";
     postauthorid = $(tmpselector).text();

     tmpselector  = "#post_box_" + msg.id + " > .post_content";
     postbody     = $(tmpselector).text();

     if (postauthorpk == facebook_self.app.wallet.returnPublicKey()) {
       facebook_self.showBrowserAlert("You cannot share your own posts");
       return;
     }

     amount = 0.0;
     fee    = 2.0;

     post_to_share = postbody + '<p></p><b>original poster: </b>';
     if (postauthorpk != "") { post_to_share += '<span class="comment_name">'+postauthorid+'</span>'; }
     post_to_share += '<br><div class="publickey_small">'+postauthorpk+'</div>'; 

     myid = "";
     if (facebook_self.app.wallet.returnIdentifier() != "") { myid = facebook_self.app.wallet.returnIdentifier() + "<br />"; }
     myid += facebook_self.app.wallet.returnPublicKey();
     share_email = 'Your post has been shared:<p></p>The user who shared it is: <p></p> '+ myid;

     var newtx = app.wallet.createUnsignedTransactionWithFee(facebook_self.app.wallet.returnPublicKey(), amount, fee);
     if (newtx == null) { return; }
     newtx.transaction.msg.module = "Facebook";
     newtx.transaction.msg.data   = post_to_share;
     newtx.transaction.msg.type   = "post";
     newtx = app.wallet.signTransaction(newtx);
     app.network.propagateTransaction(newtx);
     app.storage.saveOptions();
     facebook_self.addPostToWall(newtx, app, 1);

     var newtx = app.wallet.createUnsignedTransactionWithFee(postauthorpk, amount, fee);
     if (newtx == null) { return; }
     newtx.transaction.msg.module  = "Email";
     newtx.transaction.msg.data    = share_email;
     newtx.transaction.msg.title   = "someone has shared your post!";
     newtx = app.wallet.signTransaction(newtx);
     app.network.propagateTransaction(newtx);
     app.storage.saveOptions();

   });

}







/////////////////////////
// Handle Web Requests //
/////////////////////////
Facebook.prototype.webServer = function webServer(app, expressapp) {

  expressapp.get('/facebook/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/facebook/index.html', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/facebook/mobile.html', function (req, res) {
    res.sendFile(__dirname + '/web/mobile.html');
    return;
  });
  expressapp.get('/facebook/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });
  expressapp.get('/facebook/mobile.css', function (req, res) {
    res.sendFile(__dirname + '/web/mobile.css');
    return;
  });

}





//////////////////////////
// Handle Peer Requests //
//////////////////////////
Facebook.prototype.handlePeerRequest = function handlePeerRequest(app, message, peer, mycallback) {

    /////////////////////////////////////
    // server -- feed out transactions //
    /////////////////////////////////////
    if (message.request === "facebook load request") {

      sql    = "SELECT * FROM mod_facebook ORDER BY ID DESC LIMIT 5";
      app.storage.queryDatabaseArray(sql, {}, function(err, rows) {
        if (rows != null) {
          for (fat = rows.length-1; fat >= 0; fat--) {
            message                 = {};
            message.request         = "facebook load";
            message.data            = {};
            message.data.id         = rows[fat].id;
            message.data.tx         = rows[fat].tx;
            message.data.unixtime   = rows[fat].unixtime;
            peer.sendRequest(message.request, message.data);
          }
	  return;
        }
      });
    }


    /////////////////////////////////////////////
    // client -- load transactions from server //
    /////////////////////////////////////////////
    if (message.request == "facebook load") {


      tx = message.data.tx;
      id = message.data.id;
      unixtime = message.data.unixtime;

      newtx = new saito.transaction(tx);
      app.modules.returnModule("Facebook").addPostToWall(newtx, app, 1);

    }



}






//////////////////
// Confirmation //
//////////////////
Facebook.prototype.onConfirmation = function onConfirmation(tx, conf, app) {

  if (tx.transaction.id < app.blockchain.returnLatestBlockId()) { return; }

  // SERVER function -- save posts
  if (app.BROWSER == 0) {
    if (conf == 0) {
      myfacebook = app.modules.returnModule("Facebook");
      if (tx.transaction.msg.type == "post") { myfacebook.saveFacebookPost(tx); }
    }
    return;
  }



  // BROWSER function
  //
  // facebook all zero-conf
  if (conf == 0) {

    myfacebook = app.modules.returnModule("Facebook");

    am_i_following = 0;
    is_for_me      = 0;
    is_from_me     = 0;

    if (app.keys.isWatched(tx.transaction.to[0].add) == 1) {
      am_i_following = 1;
    }
    if (tx.transaction.to[0].add == app.wallet.returnPublicKey()) {
      is_for_me = 1;
    }
    if (tx.transaction.from[0].add == app.wallet.returnPublicKey()) {
      is_from_me = 1;
    }

    // "this" is technically the array that calls us, so we have
    // to use a roundabout way of accessing the functions in our
    // email module in the onConfirmation function.
    //
    if (tx.transaction.msg.type == "post" && (am_i_following == 1 || myfacebook.facebook.firehose == 1)) {
      app.modules.returnModule("Facebook").addPostToWall(tx, app, 1);
    }
    if (tx.transaction.msg.type == "comment") {
      if (myfacebook.facebook.filter == 0) {
        // show everything
        app.modules.returnModule("Facebook").addCommentToPost(tx, app, 0);
      } else {
        // only watching my comments
        if (am_i_following == 1) {
          app.modules.returnModule("Facebook").addCommentToPost(tx, app, 0);
        }
      }
    }


    // SAVE BECAUSE I FOLLOW
    if (am_i_following == 1) {
      app.archives.saveMessage(tx);
    } else {

      // SAVE BECAUSE IS MY POST
      if (tx.transaction.msg.type == "post" && (is_from_me == 1 || is_for_me == 1)) {
        app.archives.saveMessage(tx);
        return;
      }

      if (tx.transaction.msg.type == "comment") {

        // SAVE BECAUSE I COMMENTED + parent post
        if (is_from_me == 1 || is_for_me == 1) {

          // save parent post
          if (is_from_me == 1) {
	    if (app.archives.containsMessageById(tx.transaction.msg.post_id) == 0) {
	      parent_tx = myfacebook.generateTransactionByPostId(app, tx.transaction.msg.post_id);
              app.archives.saveMessage(parent_tx);
            }
	  }

	  // save my comment
          app.archives.saveMessage(tx);
	  return;

        } else {

	  // comment is from a stranger, but if we have saved the message
	  // we want to track the comment anyway
	  if (app.archives.containsMessageById(tx.transaction.msg.post_id) == 1) {
	    // save my comment
            app.archives.saveMessage(tx);
	    return;
	  }
        }
      }
    }
  }
}



Facebook.prototype.updateBalance = function updateBalance(app) {
  if (app.BROWSER == 0) { return; }
  $('#balance_money').html(app.wallet.returnBalance().replace(/0+$/,'').replace(/\.$/,'\.0'));
}








Facebook.prototype.formatDate = function formateDate(unixtime) {

  // not unixtime? return as may be human-readable date
  if (unixtime.toString().length < 13) { return unixtime; }

  x    = new Date(unixtime);
  nowx = new Date();
  
  y = "";

  if (x.getMonth()+1 == 1) { y += "Jan "; }
  if (x.getMonth()+1 == 2) { y += "Feb "; }
  if (x.getMonth()+1 == 3) { y += "Mar "; }
  if (x.getMonth()+1 == 4) { y += "Apr "; }
  if (x.getMonth()+1 == 5) { y += "May "; }
  if (x.getMonth()+1 == 6) { y += "Jun "; }
  if (x.getMonth()+1 == 7) { y += "Jul "; }
  if (x.getMonth()+1 == 8) { y += "Aug "; }
  if (x.getMonth()+1 == 9) { y += "Sep "; }
  if (x.getMonth()+1 == 10) { y += "Oct "; }
  if (x.getMonth()+1 == 11) { y += "Nov "; }
  if (x.getMonth()+1 == 12) { y += "Dec "; }

  y += x.getDate();

  if (x.getFullYear() != nowx.getFullYear()) {
    y += " ";
    y += x.getFullYear();
  } else {
    if (x.getMonth() == nowx.getMonth() && x.getDate() == nowx.getDate()) {
      
      am_or_pm = "am";
      
      tmphour = x.getHours();
      tmpmins = x.getMinutes();
  
      if (tmphour >= 12) { if (tmphour > 12) { tmphour -= 12; }; am_or_pm = "pm"; }
      if (tmphour == 0) { tmphour = 12; };
      if (tmpmins < 10) {
        y = tmphour + ":0" + tmpmins + " "+am_or_pm;
      } else {
        y = tmphour + ":" + tmpmins + " "+am_or_pm;
      }
    
    }
  }

  return y;

}

Facebook.prototype.formatAuthor = function formatAuthor(author, app, msg=null) {

  x = this.app.keys.findByPublicKey(author);

  if (x != null) { if (x.identifier != "") { return x.identifier; } }

  if (this.isPublicKey(author) == 1) { 
    if (msg != null) {
      app.dns.fetchIdFromAppropriateServer(author, function(answer) {

	dns_response = JSON.parse(answer);

	if (dns_response.err != "") {
	  console.log(dns_response.err);
	  return;
	}

        tmpselect = "";
        if (msg.type == "post")    { tmpselect = "#post_box_" + msg.id + " > .post_header > .post_header_titlebox > .post_header_name"; }
        if (msg.type == "comment") { tmpselect = "#comment_name_" + msg.id; }
 	$(tmpselect).html(dns_response.identifier);
      });
    }
    return author.substring(0, 18) + "...";
  }

  return author;

}
Facebook.prototype.isPublicKey = function isPublicKey(publickey) {
  if (publickey.length == 66) {
    return 1;
  }
  return 0;
}

Facebook.prototype.showBrowserAlert = function showBrowserAlert(message="error") {
  if (this.app.BROWSER == 0) { return; }
  alert(message);
}


Facebook.prototype.generateTransactionByPostId = function generateTransactionByPostId(app, post_id, childtx=null) {

  newtx = new saito.transaction();
  newtx.transaction.from.push(new saito.slip(this.app.wallet.returnPublicKey()));
  newtx.transaction.to.push(new saito.slip(this.app.wallet.returnPublicKey()));
  if (childtx != null) { newtx.transaction.ts = childtx.transaction.ts-1; }

  newtx.transaction.id = post_id;
  newtx.transaction.msg.module = "Facebook";
  newtx.transaction.msg.type = "post";
  newtx.transaction.msg.post_id = post_id;

  tmpselect = "#post_box_" + post_id + " > .post_content";
  newtx.transaction.msg.data = $(tmpselect).html();
console.log(tmpselect + " -----> " + newtx.transaction.msg.data);

  tmpselect = "#post_box_" + post_id + " > .post_header > .post_header_titlebox > .post_header_address";
  newtx.transaction.msg.poster_address = $(tmpselect).text();  
console.log(tmpselect + " -----> " + newtx.transaction.msg.poster_address);

  tmpselect = "#post_box_" + post_id + " > .post_header > .post_header_titlebox > .post_header_date";
  newtx.transaction.ts = $(tmpselect).text();
console.log(tmpselect + " -----> " + newtx.transaction.ts);

console.log("GENERATED FAKE PARENT TX: ");
console.log(newtx);

  // sign to generate unique msig
  newtx = app.wallet.signTransaction(newtx);

  return newtx;

}



