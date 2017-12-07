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
                unixtime INTEGER, \
		UNIQUE (tx), \
                PRIMARY KEY(id ASC) \
        )';
  this.app.storage.execDatabase(sql, {}, function() {});

  var sql = 'CREATE TABLE IF NOT EXISTS mod_reddit_comments (\
                id INTEGER, \
                post_id INTEGER, \
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

    if (reddit_self.reddit.firehose == 1) {
      var rdloadtimer = setTimeout(function() {
        message                 = {};
        message.request         = "reddit load request";
        message.data            = {};
        message.data.request    = "reddit load request";
        message.data.subreddit  = subreddit;
        reddit_self.app.network.sendRequest(message.request, message.data);
      }, 1500);
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

  this.addPost(null, this.app, 0);
  this.addPost(null, this.app, 0);
  this.addPost(null, this.app, 0);

  this.addComment(null, this.app, 0);
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
    msg.subreddit = subreddit;

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
    msg.module  = "Reddit";
    msg.type      = "comment";
    msg.text      = $(ud).val();
    msg.post_id   = post_id;
    msg.parent_id = id;
    msg.subreddit = subreddit;

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


}




//////////////
// Add Post //
//////////////
Reddit.prototype.addPost = function addPost(tx, app, prepend) {

  if (app.BROWSER == 0) { return; }

  // fetch data from tx
  var msg = {};
  var content_title     = "Little boy just wants to hug the police officer";
  var content_site      = "(i.imgur.com)";
  var content_details   = "submitted 4 hours ago by Electric_Mauser to /r/bitcoin";
  var content_thumbnail = "";

  if (tx != null) {
    content_title       = tx.transaction.msg.title;
    content_site        = "(u.umgur.com)";
  }

  var toInsert = '\
      <div class="post">\
        <div class="votes">\
        </div>\
        <div class="thumbnail">\
        </div>\
        <div class="content">\
          <div class="content_title">'+content_title+'</div>\
          <div class="content_site">'+content_site+'</div>\
          <div class="content_details">'+content_details+'</div>\
          <div class="content_links">\
            <div class="content_link content_link_comments">1042 comments</div>\
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

}


/////////////////
// Add Comment //
/////////////////
Reddit.prototype.addComment = function addComment(tx, app, prepend) {

  if (app.BROWSER == 0) { return; }

/*****
  // fetch data from tx
  var msg = {};
  var content_title     = "Little boy just wants to hug the police officer";
  var content_site      = "(i.imgur.com)";
  var content_details   = "submitted 4 hours ago by Electric_Mauser to /r/bitcoin";
  var content_thumbnail = "";

  if (tx != null) {
    content_title       = tx.transaction.msg.title;
    content_site        = "(u.umgur.com)";
  }
*****/

  var toInsert = '\
      <div class="comment" id="comment_0">\
        <div class="comment_upvote" id="comment_upvote_0">u</div>\
        <div class="comment_body" id="comment_body_0">\
          <div class="comment_header" id="comment_header_0">Kazzazashinobi &gt; 4 years account age. %lt; 400 comment karma. 1 point 41 minutes ago </div>\
          <div class="comment_text" id="comment_text_">\
dude, ETH has been a lame duck for the last 5 months floating between 300-400 while other cryptos skyrocketing. I beilieve due to ICOs dumping their coins constantly we see this happen\
          </div>\
          <div class="comment_links" id="comment_links_0">\
            <div class="comment_link_reply" id="comment_link_reply_0">reply</div>\
          </div>\
          <div class="comment_reply" id="comment_reply_0">\
<textarea class="comment_reply_textarea" id="comment_reply_textarea_0"></textarea>\
<input type="button" class="comment_reply_submit" id="comment_reply_submit_0" value="reply" />\
          </div>\
          <div class="comment_replies" id="comment_replies_0">\
          </div>\
        </div>\
      </div>\
    </div>\
  ';

  if (prepend == 0) {
    $('#comments').append(toInsert);
  } else {
    $('#comments').prepend(toInsert);
  }

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

      sql    = "SELECT * FROM mod_reddit_posts ORDER BY ID DESC LIMIT 5";
      app.storage.queryDatabaseArray(sql, {}, function(err, rows) {
        if (rows != null) {
          for (fat = rows.length-1; fat >= 0; fat--) {
            message                 = {};
            message.request         = "reddit load";
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
    if (message.request == "reddit load") {
      tx = message.data.tx;
      newtx = new saito.transaction(tx);
      app.modules.returnModule("Reddit").addPost(newtx, app, 1);
    }

}






//////////////////
// Confirmation //
//////////////////
Reddit.prototype.onConfirmation = function onConfirmation(blk, tx, conf, app) {

  // SERVER function
  if (app.BROWSER == 0) {
    if (conf == 0) {
      myreddit = app.modules.returnModule("Reddit");
      if (tx.transaction.msg.type == "post") { myreddit.saveRedditPost(tx); }
      if (tx.transaction.msg.type == "comment" && tx.transaction.msg.pid != null) { myreddit.saveRedditComment(tx, tx.transaction.msg.pid); }
    }
    return;
  }

}

Reddit.prototype.saveRedditPost = function saveRedditPost(tx) {
  var sql = "INSERT OR IGNORE INTO mod_reddit_posts (tx, unixtime) VALUES ($tx, $unixtime)";
  this.app.storage.queryDatabase(sql, {
    $tx: JSON.stringify(tx.transaction),
    $unixtime: tx.transaction.ts
  }, function(err, row) {});
}
Reddit.prototype.saveRedditComment = function saveRedditComment(tx, parent_id) {
  var sql = "INSERT OR IGNORE INTO mod_reddit_comments (tx, parent_id, unixtime) VALUES ($tx, $parent_id, $unixtime)";
  this.app.storage.queryDatabase(sql, {
    $tx: JSON.stringify(tx.transaction),
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
  if (publickey.length == 66) {
    return 1;
  }
  return 0;
}
Reddit.prototype.showBrowserAlert = function showBrowserAlert(message="error") {
  if (this.app.BROWSER == 0) { return; }
  alert(message);
}



