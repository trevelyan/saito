var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var fs   = require('fs');

//////////////////
// CONSTRUCTOR  //
//////////////////
function Reddit(app) {

  if (!(this instanceof Reddit)) { return new Reddit(app); }

  Reddit.super_.call(this);

  this.app               = app;

  this.name              = "Reddit";

  this.publickey         = "MY_PUBLICKEY";

  this.reddit            = {};
  this.reddit.firehose   = 1;   // do I want ALL posts
				// 1 = show me everything
				// 0 = only friends

  this.reddit.filter     = 0;   // do I want ALL comments
				//
				// 0 = show all comments
				// 1 = only comments from ppl I follow

  this.browser_active    = 0;

  this.mylastposttime    = 0;
  this.mylastcommenttime = 0;

  // a parent variable called "subreddit" 
  // is included in the HTML and edited
  // directly by this script. see webSefver
  // function.

  return this;

}
module.exports = Reddit;
util.inherits(Reddit, ModTemplate);








////////////////////
// Install Module //
////////////////////
Reddit.prototype.installModule = function installModule() {

  var sql = 'CREATE TABLE IF NOT EXISTS mod_reddit_posts (\
                id INTEGER, \
                tx TEXT, \
                post_id TEXT, \
                subreddit TEXT, \
                unixtime INTEGER, \
		UNIQUE (tx), \
                PRIMARY KEY(id ASC) \
        )';
  this.app.storage.execDatabase(sql, {}, function() {});

  var sql = 'CREATE TABLE IF NOT EXISTS mod_reddit_comments (\
                id INTEGER, \
                post_id TEXT, \
                comment_id TEXT, \
                parent_id TEXT, \
                tx TEXT, \
                unixtime INTEGER, \
		UNIQUE (tx), \
                PRIMARY KEY(id ASC) \
        )';
  this.app.storage.execDatabase(sql, {}, function() {});

}



////////////////
// Initialize //
////////////////
Reddit.prototype.initialize = function initialize() {

  if (this.browser_active == 0) { return; }

  if (this.app.BROWSER == 1) {

    var reddit_self = this;

    ////////////////
    // SUBREDDITS //
    ////////////////
    if (post_id == "") {
    if (reddit_self.reddit.firehose == 1) {
      var rdloadtimer = setTimeout(function() {
        message                 = {};
        message.request         = "reddit load request";
        message.data            = {};
        message.data.request    = "reddit load request";
        message.data.subreddit  = subreddit;
        message.data.post_id    = post_id;
        message.data.comment_id = comment_id;
        reddit_self.app.network.sendRequest(message.request, message.data);
      }, 500);
    }
    }


    //////////////////////
    // POSTS & COMMENTS //
    //////////////////////
    if (post_id != "") {
      var rdloadtimer = setTimeout(function() {
        message                 = {};
        message.request         = "reddit load post";
        message.data            = {};
        message.data.request    = "reddit load post";
        message.data.subreddit  = subreddit;
        message.data.post_id    = post_id;
        message.data.comment_id = comment_id;
        reddit_self.app.network.sendRequest(message.request, message.data);
      }, 500);
    }
  }
}



/////////////////////
// Initialize HTML //
/////////////////////
Reddit.prototype.initializeHTML = function initializeHTML(app) {

  if (app.BROWSER == 0) { return; }

  // update name
  if (app.wallet.returnIdentifier() != "") {
    $('#saitoname').text(app.wallet.returnIdentifier());
  } else {
    $('#saitoname').text(this.formatAuthor(app.wallet.returnPublicKey()));
  }

}

///////////////////
// Attach Events //
///////////////////
Reddit.prototype.attachEvents = function attachEvents(app) {

  var reddit_self = this;

  if (app.BROWSER == 0) { return; }

 
  // toggle submission
  $('#submit').off();
  $('#submit').on('click', function() {
    $('#submit_post').toggle();
  });



  // submit new post
  $('#submit_button').off();
  $('#submit_button').on('click', function() {

    // fetch data from tx
    var msg = {};
    msg.module  = "Reddit";
    msg.type      = "post";
    msg.title     = $('#submit_title').val();
    msg.link      = $('#submit_link').val();
    msg.text      = $('#submit_text').val();
    msg.subreddit = $('#submit_r').val();

    var amount = 0.0;
    var fee    = 2.0001;

    // send post across network
    var newtx = app.wallet.createUnsignedTransaction(reddit_self.publickey, amount, fee);
    if (newtx == null) { alert("Unable to send TX"); return; }
    newtx.transaction.msg = msg;
    newtx = app.wallet.signTransaction(newtx);
    app.network.propagateTransactionWithCallback(newtx, function() {
      alert("your message has been broadcast to the network.");
      reddit_self.addPost(newtx, reddit_self.app, 1);
      $('#submit_post').toggle();
    });
  });




  // toggle comment form
  $('.comment_link_reply').off();
  $('.comment_link_reply').on('click', function() {
    var id = $(this).attr('id').substring(19);
    var togglediv = "#comment_reply_"+id;
    $(togglediv).toggle();
  });



  // submit new comment
  $('.comment_reply_submit').off();
  $('.comment_reply_submit').on('click', function() {

    var id = $(this).attr('id').substring(21);
    var ud = "#comment_reply_textarea_"+id;

    // fetch data from tx
    var msg = {};
    msg.module    = "Reddit";
    msg.type       = "comment";
    msg.text       = $(ud).val();
    msg.post_id    = post_id;
    msg.parent_id  = id;
    msg.subreddit  = subreddit;

    var amount = 0.0;
    var fee    = 2.0001;

    // send post across network
    var newtx = app.wallet.createUnsignedTransaction(reddit_self.publickey, amount, fee);
    if (newtx == null) { alert("Unable to send TX"); return; }
    newtx.transaction.msg = msg;
    newtx = app.wallet.signTransaction(newtx);
    app.network.propagateTransactionWithCallback(newtx, function() {
      alert("your message has been broadcast to the network.");
      reddit_self.addComment(newtx, reddit_self.app, 1);
      var rd = "#comment_reply_"+id;
      $(rd).toggle();
      if (id == 0) { $('#comment_reply_textarea_0').val(""); }
    });

  });


}




//////////////
// Add Post //
//////////////
Reddit.prototype.addPost = function addPost(tx, app, prepend) {

  if (app.BROWSER == 0) { return; }

console.log("HERE: "+post_id);

  // for post & comment pages
  if (post_id != null && post_id != "") {
    $('#d_content_title').text(tx.transaction.msg.title);
    $('#d_content_r').text("/r/"+tx.transaction.msg.subreddit);
    $('#d_content_details').text("submitted by "+this.formatAuthor(tx.transaction.from[0].add));
    $('#d_text').text(tx.transaction.msg.text);
    return;
  } 


  // fetch data from tx
  var msg = {};
  var content_title     = "Title Loading";
  var content_site      = "(i.imgur.com)";
  var content_details   = "";
  var content_thumbnail = "";
  var content_subreddit = "";
  var cpost_id          = "";

  if (tx != null) {
    content_title       = tx.transaction.msg.title;
    cpost_id             = tx.transaction.sig;
    content_subreddit   = tx.transaction.msg.subreddit;
    content_site        = "(u.umgur.com)";
    content_details     = "submitted by "+this.formatAuthor(tx.transaction.from[0].add)+' to <a href="/r/'+tx.transaction.msg.subreddit+'">/r/'+tx.transaction.msg.subreddit+'</a>';
  }


  var toInsert = '\
      <div class="post">\
        <div class="votes">\
<div class="upvote_wrapper"><i class="fa fa-arrow-up upvote post_upvote" id="post_upvote" aria-hidden="true"></i></div>\
<div class="downvote_wrapper"><i class="fa fa-arrow-down downvote post_downvote" id="post_downvote" aria-hidden="true"></i></div>\
        </div>\
        <div class="thumbnail">\
        </div>\
        <div class="content">\
          <div class="content_title">'+content_title+'</div>\
          <div class="content_site">'+content_site+'</div>\
          <div class="content_details">'+content_details+'</div>\
          <div class="content_links">\
            <a href="/r/'+content_subreddit+'/'+cpost_id+'" class="content_link content_link_comments">read comments</a>\
            <div class="content_link content_link_share">share</div>\
            <div class="content_link content_link_save">save</div>\
            <div class="content_link content_link_block">block</div>\
          </div>\
        </div>\
      </div>\
  ';

  if (prepend == 0) {
    $('#posts').append(toInsert);
  } else {
    $('#posts').prepend(toInsert);
  }

  this.attachEvents(this.app);

}


/////////////////
// Add Comment //
/////////////////
Reddit.prototype.addComment = function addComment(tx, app, prepend) {

  if (app.BROWSER == 0) { return; }

  // fetch data from tx
  var msg = {};
  var content_text      = "Comment";
  var pid               = 0;
  var cid               = 0;

  if (tx != null) {
    content_text  = tx.transaction.msg.text;
    pid           = tx.transaction.msg.parent_id;
    cid           = tx.transaction.sig;
  }

  var toInsert = '\
      <div class="comment" id="comment_'+cid+'">\
        <div class="comment_upvotes" id="comment_upvotes_'+cid+'">\
<div class="upvote_wrapper"><i class="fa fa-arrow-up upvote comment_upvote" id="comment_upvote_'+cid+'" aria-hidden="true"></i></div>\
<div class="downvote_wrapper"><i class="fa fa-arrow-down downvote comment_downvote" id="comment_downvote_'+cid+'" aria-hidden="true"></i></div>\
	</div>\
        <div class="comment_body" id="comment_body_'+cid+'">\
          <div class="comment_header" id="comment_header_'+cid+'">'+this.formatAuthor(tx.transaction.from[0].add)+'</div>\
          <div class="comment_text" id="comment_text_'+cid+'">'+content_text+'</div>\
          <div class="comment_links" id="comment_links_'+cid+'">\
            <div class="comment_link comment_link_reply" id="comment_link_reply_'+cid+'">reply</div>\
          </div>\
          <div class="comment_reply" id="comment_reply_'+cid+'">\
<textarea class="comment_reply_textarea" id="comment_reply_textarea_'+cid+'"></textarea>\
<input type="button" class="comment_reply_submit" id="comment_reply_submit_'+cid+'" value="reply" />\
          </div>\
          <div class="comment_replies" id="comment_replies_'+cid+'">\
          </div>\
        </div>\
      </div>\
    </div>\
  ';

  // top-level comment
  var divtoadd = "#comments";
  if (pid != 0) { divtoadd = "#comment_replies_"+pid; }

  if (prepend == 0) {
    $(divtoadd).append(toInsert);
  } else {
    $(divtoadd).prepend(toInsert);
  }

  this.attachEvents(this.app);

}








/////////////////////////
// Handle Web Requests //
/////////////////////////
Reddit.prototype.webServer = function webServer(app, expressapp) {

  expressapp.get('/r/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });
  expressapp.get('/r', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/r/:subreddit', function (req, res) {
    var this_subreddit = req.params.subreddit;
    var data = fs.readFileSync(__dirname + '/web/index.html', 'utf8', (err, data) => {});
    data = data.replace('subreddit = ""','subreddit = "'+this_subreddit+'"');
    res.setHeader('Content-type', 'text/html');
    res.charset = 'UTF-8';
    res.write(data);
    res.end();
    return;
  });
  expressapp.get('/r/:subreddit/:post_id', function (req, res) {
    var this_subreddit = req.params.subreddit;
    var this_post_id   = req.params.post_id;
    var data = fs.readFileSync(__dirname + '/web/post.html', 'utf8', (err, data) => {});
    data = data.replace('subreddit = ""','subreddit = "'+this_subreddit+'"');
    data = data.replace('post_id = ""','post_id = "'+this_post_id+'"');
    res.setHeader('Content-type', 'text/html');
    res.charset = 'UTF-8';
    res.write(data);
    res.end();
    return;
  });
  expressapp.get('/r/:subreddit/:post_id/:comment_id', function (req, res) {
    var this_subreddit = req.params.subreddit;
    var this_post_id   = req.params.post_id;
    var this_comment_id = req.params.comment_id;
    var data = fs.readFileSync(__dirname + '/web/post.html', 'utf8', (err, data) => {});
    data = data.replace('subreddit = ""','subreddit = "'+this_subreddit+'"');
    data = data.replace('post_id = ""','post_id = "'+this_post_id+'"');
    data = data.replace('comment_id = ""','comment_id = "'+this_comment_id+'"');
    res.setHeader('Content-type', 'text/html');
    res.charset = 'UTF-8';
    res.write(data);
    res.end();
    return;
  });

}
















//////////////////////////
// Handle Peer Requests //
//////////////////////////
Reddit.prototype.handlePeerRequest = function handlePeerRequest(app, message, peer, mycallback) {

    /////////////////////////////////////
    // server -- feed out transactions //
    /////////////////////////////////////
    if (message.request === "reddit load request") {

      var sql    = "SELECT * FROM mod_reddit_posts ORDER BY ID DESC LIMIT 5";
      app.storage.queryDatabaseArray(sql, {}, function(err, rows) {
        if (rows != null) {
          for (var fat = rows.length-1; fat >= 0; fat--) {
            message                 = {};
            message.request         = "reddit load";
            message.data            = {};
            message.data.id         = rows[fat].id;
            message.data.tx         = rows[fat].tx;
            message.data.subreddit  = rows[fat].subreddit;
            message.data.post_id    = rows[fat].post_id;
            message.data.unixtime   = rows[fat].unixtime;
console.log("\n\nSENDING DATA");
console.log(message.data);
            peer.sendRequest(message.request, message.data);
          }
	  return;
        }
      });
    }



    /////////////////////////////////////
    // server -- feed out transactions //
    /////////////////////////////////////
    if (message.request === "reddit load post") {

console.log("\n\nREDDIT LOAD POST\n\n");

      var pid = message.data.post_id;
      var cid = message.data.comment_id;

      var sql    = "SELECT * FROM mod_reddit_posts WHERE post_id = $pid";
      app.storage.queryDatabaseArray(sql, { $pid : pid }, function(err, rows) {

        if (rows != null) {
          for (var fat = rows.length-1; fat >= 0; fat--) {
            var message             = {};
            message.request         = "reddit post";
            message.data            = {};
            message.data.id         = rows[fat].id;
            message.data.tx         = rows[fat].tx;
            message.data.unixtime   = rows[fat].unixtime;
            peer.sendRequest(message.request, message.data);


	    // fetch comments
            var sql2 = "SELECT * FROM mod_reddit_comments WHERE post_id = $pid ORDER BY unixtime ASC";
            app.storage.queryDatabaseArray(sql2, { $pid : pid }, function(err, rows2) {
              if (rows2 != null) {
                for (var fat2 = 0; fat2 <= rows2.length-1; fat2++) {
                  var message2             = {};
                  message2.request         = "reddit comment";
                  message2.data            = {};
                  message2.data.id         = rows2[fat2].id;
                  message2.data.tx         = rows2[fat2].tx;
                  message2.data.unixtime   = rows2[fat2].unixtime;
                  peer.sendRequest(message2.request, message2.data);
	        }
              }
            });
	  }
        }
	return;
      });
    }



    /////////////////////////////////////////////
    // client -- load transactions from server //
    /////////////////////////////////////////////
    if (message.request == "reddit load") {
      newtx = new saito.transaction(message.data.tx);
      app.modules.returnModule("Reddit").addPost(newtx, app, 1);
      return;
    }



    /////////////////////////
    // client -- load post //
    /////////////////////////
    if (message.request == "reddit post") {
      tx = message.data.tx;
      newtx = new saito.transaction(tx);
console.log("ADD POST: ");
console.log(newtx);
      app.modules.returnModule("Reddit").addPost(newtx, app, 1);
      return;
    }

    ////////////////////////////
    // client -- load comment //
    ////////////////////////////
    if (message.request == "reddit comment") {
      tx = message.data.tx;
      newtx = new saito.transaction(tx);
      app.modules.returnModule("Reddit").addComment(newtx, app, 1);
      return;
    }

}






///////////////////
// Confirmation //
//////////////////
Reddit.prototype.onConfirmation = function onConfirmation(blk, tx, conf, app) {

  // SERVER function
  if (app.BROWSER == 0) {
    if (conf == 0) {
console.log("ON CONFIRMATION: ");
      myreddit = app.modules.returnModule("Reddit");
console.log("TX: "+tx.transaction.msg.type);
console.log("TYPE: "+tx.transaction.msg.type);
console.log("POST_ID: "+tx.transaction.msg.post_id);
console.log("PARENT_ID: "+tx.transaction.msg.parent_id);
      if (tx.transaction.msg.type == "post") { myreddit.savePost(tx); }
      if (tx.transaction.msg.type == "comment" && (tx.transaction.msg.parent_id != null || tx.transaction.msg.post_id != null)) { myreddit.saveComment(tx, tx.transaction.msg.post_id, tx.transaction.msg.parent_id); }
    }
    return;
  }

}

Reddit.prototype.savePost = function savePost(tx) {
  var sql = "INSERT OR IGNORE INTO mod_reddit_posts (tx, post_id, subreddit, unixtime) VALUES ($tx, $post_id, $subreddit, $unixtime)";
console.log(sql);
  this.app.storage.queryDatabase(sql, {
    $tx: JSON.stringify(tx.transaction),
    $post_id: tx.transaction.sig,
    $subreddit: tx.transaction.msg.subreddit,
    $unixtime: tx.transaction.ts
  }, function(err, row) {});
}
Reddit.prototype.saveComment = function saveComment(tx, post_id, parent_id) {
  var sql = "INSERT OR IGNORE INTO mod_reddit_comments (tx, post_id, comment_id, parent_id, unixtime) VALUES ($tx, $post_id, $comment_id, $parent_id, $unixtime)";

console.log("\n\n\n\n"+sql+"\n\n\n\n");

  this.app.storage.queryDatabase(sql, {
    $tx: JSON.stringify(tx.transaction),
    $post_id: post_id,
    $comment_id: tx.transaction.sig,
    $parent_id: parent_id,
    $unixtime: tx.transaction.ts
  }, function(err, row) {});
}































////////////////////
// handle options //
////////////////////
Reddit.prototype.saveReddit = function saveReddit(app) {
  app.options.reddit = this.reddit;
  app.storage.saveOptions();
}
Reddit.prototype.updateFilter = function updateFilter(nf) {
  this.reddit.filter = nf;
  this.saveReddit();
}
Reddit.prototype.updateFirehose = function updateFirehose(nf) {
  this.reddit.firehose = nf;
  this.saveReddit();
}
Reddit.prototype.updateBalance = function updateBalance(app) {
  if (app.BROWSER == 0) { return; }
  $('#balance_money').html(app.wallet.returnBalance().replace(/0+$/,'').replace(/\.$/,'\.0'));
}
Reddit.prototype.formatDate = function formateDate(unixtime) {

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
Reddit.prototype.formatAuthor = function formatAuthor(author, app, msg=null) {

  x = this.app.keys.findByPublicKey(author);

  if (x != null) { if (x.identifier != "") { return x.identifier; } }

  if (this.isPublicKey(author) == 1) { 
    if (msg != null) {
      app.dns.fetchIdFromAppropriateServer(author, function(answer) {

	if (app.dns.isRecordValid(answer) == 0) {
	  console.log(answer);
	  return;
	}

	dns_response = JSON.parse(answer);

        var tmpselect = "";
        if (msg.type == "post")    { tmpselect = "#post_box_" + msg.id + " > .post_header > .post_header_titlebox > .post_header_name"; }
        if (msg.type == "comment") { tmpselect = "#comment_name_" + msg.id; }
 	$(tmpselect).html(dns_response.identifier);
      });
    }
    return author.substring(0, 18) + "...";
  }

  return author;

}
Reddit.prototype.isPublicKey = function isPublicKey(publickey) {
  if (publickey.length == 44 || publickey.length == 45) {
    return 1;
  }
  return 0;
}
Reddit.prototype.showBrowserAlert = function showBrowserAlert(message="error") {
  if (this.app.BROWSER == 0) { return; }
  alert(message);
}


