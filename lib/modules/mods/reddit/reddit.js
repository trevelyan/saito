var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var fs   = require('fs');
var URL  = require('url-parse');


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
                votes INTEGER, \
                rank INTEGER, \
                comments INTEGER, \
                tx TEXT, \
                post_id TEXT, \
                reported INTEGER, \
                approved INTEGER, \
                url TEXT, \
                domain TEXT, \
                subreddit TEXT, \
                unixtime INTEGER, \
                unixtime_rank INTEGER, \
		UNIQUE (tx), \
                PRIMARY KEY(id ASC) \
        )';
  this.app.storage.execDatabase(sql, {}, function() {});

  var sql = 'CREATE TABLE IF NOT EXISTS mod_reddit_comments (\
                id INTEGER, \
                votes INTEGER, \
                post_id TEXT, \
                comment_id TEXT, \
                parent_id TEXT, \
                reported INTEGER, \
                approved INTEGER, \
                tx TEXT, \
                unixtime INTEGER, \
		UNIQUE (tx), \
                PRIMARY KEY(id ASC) \
        )';
  this.app.storage.execDatabase(sql, {}, function() {});

  var sql = 'CREATE TABLE IF NOT EXISTS mod_reddit_votes (\
                id INTEGER, \
                docid TEXT, \
                publickey TEXT, \
		UNIQUE (publickey, docid), \
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


  $('.post_author_clickable').off();
  $('.post_author_clickable').on('click', function() {

    var myid = $(this).attr('id');
    myid = myid.substring(22);
    var author_key_div = "#post_author_"+myid;
    var author_key = $(author_key_div).text();

    var blacklist_post = confirm("Do you want to blacklist this user?");
    if (blacklist_post) {
      alert("You will not see further posts or comments from this user");
      reddit_self.app.keys.addKey(author_key, "", 0, "blacklisted");
    }
  });



  $('.content_link_report').off();
  $('.content_link_report').on('click', function() {

    var myid = $(this).attr('id');
    myid = myid.substring(20);

    var report_this = confirm("Report to Site Admins?")
    if (report_this) {
      alert("You have flagged this post for review");

      message                 = {};
      message.request         = "reddit report";
      message.data            = {};
      message.data.request    = "reddit report";
      message.data.subreddit  = subreddit;
      message.data.post_id    = myid;
      reddit_self.app.network.sendRequest(message.request, message.data);

    }

  });




 
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
      reddit_self.addPost(newtx, null, reddit_self.app, 1);
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
      reddit_self.addComment(newtx, null, reddit_self.app, 1);
      var rd = "#comment_reply_"+id;
      $(rd).toggle();
      if (id == 0) { $('#comment_reply_textarea_0').val(""); }
    });

  });



  ////////////
  // voting //
  ////////////
  $('.upvote_wrapper').off();
  $('.upvote_wrapper').on('click', function() {
    var upid   = $(this).attr("id");
    var cid    = upid.split("_")[2];
    reddit_self.vote(1, cid);
  });

  $('.downvote_wrapper').off();
  $('.downvote_wrapper').off();
  $('.downvote_wrapper').on('click', function() {
    var downid = $(this).attr("id");
    //var cid    = downid.substring(14);
    var cid    = downid.split("_")[2];
    reddit_self.vote(-1, cid);
  });


}
Reddit.prototype.vote = function vote(vote, docid) {

  var post = "post"; // 1 for post

  var tmpd = "#comment_"+docid;
  if ($(tmpd).length > 0) { post = "comment"; }

  var vtdiv  = "#votes_total_"+docid;
  var vtdivn = $(vtdiv).html();
  $(vtdiv).html(parseInt($(vtdiv).text())+parseInt(vote));

  message                 = {};
  message.request         = "reddit vote";
  message.data            = {};
  message.data.request    = "reddit vote";
  message.data.vote       = vote;
  message.data.type       = post;
  message.data.id         = docid;
  this.app.network.sendRequest(message.request, message.data);
  
}





//////////////
// Add Post //
//////////////
Reddit.prototype.addPost = function addPost(tx, message, app, prepend) {

  if (app.BROWSER == 0) { return; }


  if (this.app.keys.isTagged(tx.transaction.from[0].add, "blacklisted") == 1) { return; }

  // for post & comment pages
  if (post_id != null && post_id != "") {
    var st = '<a href="'+message.url+'">'+tx.transaction.msg.title+'</a>';
    var sr = '<a href="/r/'+message.subreddit+'">/r/'+message.subreddit+'</a>';
    var ss = '('+message.domain+')';
    $('#d_post_author').text(tx.transaction.from[0].add);
    $('#d_content_title').text(tx.transaction.msg.title);
    $('#d_content_r').text(sr);
    $('#d_content_site').text(sr);
    $('#d_content_details').text('submitted by <span class=".post_author_clickable" id="post_author_clickable_'+post_id+'">'+this.formatAuthor(tx.transaction.from[0].add)+'</span>');
    $('#d_text').text(tx.transaction.msg.text);
    if (message != null) {
      $('#d_votes > .votes_total').text(message.data.comments);
      var dv = "downvote_wrapper_"+tx.transaction.sig;
      var uv = "upvote_wrapper_"+tx.transaction.sig;
      var vt = "votes_total_"+tx.transaction.sig;
      var pa = "post_author_"+post_id;;
      $('#d_votes > .upvote_wrapper').attr('id', uv);
      $('#d_votes > .downvote_wrapper').attr('id', dv);
      $('#d_votes > .votes_total').attr('id', vt);
      $('#d > .post_author').attr('id', pa);
      $('#d > .post_author').text(tx.transaction.from[0].add);
    }
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
  var content_link      = "";
  var content_site_link = "";
  var comments_link     = "";
  var comments_text     = "read comments";
  var votes_total       = 1;

  if (tx != null) {

    // figure out what the URL is
    var myhref = tx.transaction.msg.link;
    if (myhref.indexOf("http://") != 0 && myhref.indexOf("https://") != 0) { myhref = "http://" + myhref; }
    var link   = new URL(myhref);

    content_title       = tx.transaction.msg.title;
    cpost_id            = tx.transaction.sig;
    content_subreddit   = '/r/'+tx.transaction.msg.subreddit;
    if (content_subreddit == '/r/') {
      content_subreddit = "/r/main";
    }
    content_site        = content_subreddit;
    content_site_link   = "";
    content_details     = "submitted by <span class=\"post_author_clickable\" id=\"post_author_clickable_"+cpost_id+"\">"+this.formatAuthor(tx.transaction.from[0].add)+'</span> to <a href="/r/'+tx.transaction.msg.subreddit+'">/r/'+tx.transaction.msg.subreddit+'</a>';
    content_link        = '/r/'+content_subreddit+'/'+cpost_id;
    comments_link       = '/r/'+content_subreddit+'/'+cpost_id;
    if (link.href != "") {
      content_link      = link.href;
    }
    if (link.hostname != "") { 
      content_site      = link.hostname;
      content_site_link = "http://";
    }

    comments_text       = "read comments";
    if (message != null) {
      if (message.data.comments == 1) { comments_text = "1 comment"; }
      if (message.data.comments > 1) { comments_text = message.data.comments + " comments"; }
      votes_total       = message.data.votes;
    }
  }


  var toInsert = '\
      <div class="post" id="post_'+cpost_id+'">\
        <div class="post_author" id="post_author_'+cpost_id+'">'+tx.transaction.from[0].add+'</div>\
        <div class="votes">\
<div class="upvote_wrapper" id="post_upvote_'+cpost_id+'"><i class="fa fa-arrow-up upvote post_upvote" aria-hidden="true"></i></div>\
<div class="votes_total" id="votes_total_'+cpost_id+'">'+votes_total+'</div>\
<div class="downvote_wrapper" id="post_downvote_'+cpost_id+'"><i class="fa fa-arrow-down downvote post_downvote" aria-hidden="true"></i></div>\
        </div>\
        <div class="thumbnail">\
        </div>\
        <div class="content">\
          <div class="content_title"><a href="'+content_link+'">'+content_title+'</a></div>\
          <div class="content_site">(<a href="'+content_site_link+content_site+'">'+content_site+'</a>)</div>\
          <div class="content_details">'+content_details+'</div>\
          <div class="content_links">\
            <a href="'+content_subreddit+'/'+cpost_id+'" class="content_link content_link_comments">'+comments_text+'</a>\
            <div class="content_link content_link_report" id="content_link_report_'+cpost_id+'">report</div>\
          </div>\
        </div>\
      </div>\
  ';

  if (prepend == 0) {
    $('#posts').append(toInsert);
  } else {
    $('#posts').prepend(toInsert);
  }

  this.reorderPosts(cpost_id);
  this.attachEvents(this.app);

}


/////////////////
// Add Comment //
/////////////////
Reddit.prototype.addComment = function addComment(tx, message, app, prepend) {

  if (app.BROWSER == 0) { return; }

  // fetch data from tx
  var msg = {};
  var content_text      = "Comment";
  var pid               = 0;
  var cid               = 0;
  var votes_total       = 1;

  if (tx != null) {
    content_text  = tx.transaction.msg.text;
    pid           = tx.transaction.msg.parent_id;
    cid           = tx.transaction.sig;
  }

  if (message != null) {
    votes_total   = message.data.votes;
  }

  var toInsert = '\
      <div class="comment" id="comment_'+cid+'">\
        <div class="comment_upvotes" id="comment_upvotes_'+cid+'">\
<div class="upvote_wrapper" id="upvote_wrapper_'+cid+'"><i class="fa fa-arrow-up upvote comment_upvote" aria-hidden="true"></i></div>\
<div class="votes_total" id="votes_total_'+cid+'">'+votes_total+'</div>\
<div class="downvote_wrapper" id="upvote_wrapper_'+cid+'"><i class="fa fa-arrow-down downvote comment_downvote" aria-hidden="true"></i></div>\
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

  this.reorderComments(cid);
  this.attachEvents(this.app);

}




///////////////////
// Reorder Posts //
///////////////////
Reddit.prototype.reorderPosts = function reorderPosts(cid) {

  var reddit_self = this;

  var aid = '#post_'+cid;
  var avt = '#votes_total_'+cid;
   
  var myobj    = $(aid);
  var myvotes  = $(avt).html();
  var parent   = $(aid).parent();
  var children = $(aid).parent().children();

  var changed  = 0;
  var reachedus = 0;

  children.each(function() {

    var bid    = '#post_' + $(this).attr('id').substring(5) ;
    var bvt    = '#votes_total_' + $(this).attr('id').substring(5) ;
    var bvotes = $(bvt).html();

    if (reachedus == 1) {

      if (parseInt(bvotes) > parseInt(myvotes)) {
        var div1 = $(myobj);
        var div2 = $(this);
        div1.detach();
        div1.insertAfter(div2);
        changed = 1;
        reddit_self.reorderComments(cid);
      } 

    }
    if (bid === aid) { reachedus = 1; }

  });


}
//////////////////////
// Reorder Comments //
//////////////////////
Reddit.prototype.reorderComments = function reorderComments(cid) {

  var reddit_self = this;

  var aid = '#comment_'+cid;
  var avt = '#votes_total_'+cid;
   
  var myobj    = $(aid);
  var myvotes  = $(avt).html();
  var parent   = $(aid).parent();
  var children = $(aid).parent().children();

  var changed  = 0;
  var reachedus = 0;

  children.each(function() {

    var bid    = '#comment_' + $(this).attr('id').substring(8) ;
    var bvt    = '#votes_total_' + $(this).attr('id').substring(8) ;
    var bvotes = $(bvt).html();

    if (reachedus == 1) {

      if (parseInt(bvotes) > parseInt(myvotes)) {
        var div1 = $(myobj);
        var div2 = $(this);
        div1.detach();
        div1.insertAfter(div2);
        changed = 1;
        reddit_self.reorderComments(cid);
      } 

    }
    if (bid === aid) { reachedus = 1; }

  });

}











/////////////////////////
// Handle Web Requests //
/////////////////////////
Reddit.prototype.webServer = function webServer(app, expressapp) {

  expressapp.get('/r/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });
  expressapp.get('/r/about.html', function (req, res) {
    res.sendFile(__dirname + '/web/about.html');
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
  expressapp.get('/r', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });

}




//////////////////////////
// Handle Peer Requests //
//////////////////////////
Reddit.prototype.handlePeerRequest = function handlePeerRequest(app, message, peer, mycallback) {

    /////////////////////
    // server -- posts //
    /////////////////////
    if (message.request === "reddit load request") {

      var sr = message.data.subreddit;
      var sql    = "SELECT * FROM mod_reddit_posts ORDER BY ID DESC LIMIT 20";
      var params = {};
      if (sr != "" && sr != null) {
	sql = "SELECT * FROM mod_reddit_posts WHERE subreddit = $sr ORDER BY ID DESC LIMIT 20";
        params = { $sr : sr };
      }
      app.storage.queryDatabaseArray(sql, params, function(err, rows) {
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
            message.data.comments   = rows[fat].comments;
            message.data.votes      = rows[fat].votes;
            peer.sendRequest(message.request, message.data);
          }
	  return;
        }
      });
    }





    /////////////////////////////////////
    // server -- report TOS violations //
    /////////////////////////////////////
    if (message.request === "reddit report") {

      var rp = message.data.post_id;
      var sql    = "UPDATE mod_reddit_posts SET reported = reported+1 WHERE post_id = $pid";
      var params = { $pid : rp };
      app.storage.execDatabase(sql, params, function(err, rows) {
      });

    }









    /////////////////////
    // server -- votes //
    /////////////////////
    if (message.request === "reddit vote") {

      var vote  = message.data.vote;
      var type  = message.data.type;
      var docid = message.data.id;
      var voter = peer.peer.publickey;

      var reddit_self = this;

      var sql = "SELECT count(*) AS count FROM mod_reddit_votes WHERE docid = $dic AND publickey = $pkey";
      var params = { $dic : docid , $pkey : voter };

      this.app.storage.queryDatabase(sql, params, function(err, row) {
	if (row != null) {
	  if (row.count == 1) { return; }

	  var sql2    = "INSERT OR IGNORE INTO mod_reddit_votes (docid, publickey) VALUES ($docid, $pkey)";
	  var params2 = { $docid : docid , $pkey : voter };
	  reddit_self.app.storage.execDatabase(sql2, params2, function(err) {

      	    var sql3 = "";
	    var params3 = { $pid : docid };


      	    if (type == "post") {

 	      // if we haven't voted yet, we are permitted to vote
	      var current_time = new Date().getTime();
	      var vote_bonus   = 1000000;

              sql3 = "UPDATE mod_reddit_posts SET votes = votes + 1, unixtime_rank = cast((unixtime_rank + ($vote_bonus * (2000000/($current_time-unixtime)))) as INTEGER) WHERE post_id = $pid";
	      params3 = { $pid : docid , $vote_bonus : vote_bonus , $current_time : current_time };   
           if (vote == -1) {
                sql3 = "UPDATE mod_reddit_posts SET votes = votes + 1, unixtime_rank = cast((unixtime_rank - ($vote_bonus * (2000000/($current_time-unixtime)))) as INTEGER) WHERE post_id = $pid";
	        params3 = { $pid : docid , $vote_bonus : vote_bonus , $current_time : current_time };
              }
            } else {
              sql3 = "UPDATE mod_reddit_comments SET votes = votes + 1 WHERE comment_id = $pid";
              if (vote == -1) {
                sql3 = "UPDATE mod_reddit_comments SET votes = votes - 1 WHERE comment_id = $pid";
              }
            }
            app.storage.execDatabase(sql3, params3, function(err, rows) {
            });
	  });
	}
      });
    }



    ///////////////////////////////
    // server -- post + comments //
    ///////////////////////////////
    if (message.request === "reddit load post") {

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
            message.data.votes      = rows[fat].votes;
            message.data.comments   = rows[fat].comments;
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
                  message2.data.votes      = rows2[fat2].votes;
                  peer.sendRequest(message2.request, message2.data);
	        }
              }
            });
	  }
        }
	return;
      });
    }



    //////////////////////////
    // client -- front page //
    //////////////////////////
    if (message.request == "reddit load") {
      newtx = new saito.transaction(message.data.tx);
      app.modules.returnModule("Reddit").addPost(newtx, message, app, 1);
      return;
    }



    ////////////////////
    // client -- post //
    ////////////////////
    if (message.request == "reddit post") {
      tx = message.data.tx;
      newtx = new saito.transaction(tx);
      app.modules.returnModule("Reddit").addPost(newtx, message, app, 1);
      return;
    }

    ///////////////////////
    // client -- comment //
    ///////////////////////
    if (message.request == "reddit comment") {
      tx = message.data.tx;
      newtx = new saito.transaction(tx);
      app.modules.returnModule("Reddit").addComment(newtx, message, app, 1);
      return;
    }

}






///////////////////
// Confirmation //
//////////////////
Reddit.prototype.onConfirmation = function onConfirmation(blk, tx, conf, app) {

  if (tx.transaction.msg.module != "Reddit") { return; }

  // SERVER function
  if (app.BROWSER == 0) {
    if (conf == 0) {
      myreddit = app.modules.returnModule("Reddit");
      if (tx.transaction.msg.type == "post") { myreddit.savePost(tx); }
      if (tx.transaction.msg.type == "comment" && (tx.transaction.msg.parent_id != null || tx.transaction.msg.post_id != null)) { myreddit.saveComment(tx, tx.transaction.msg.post_id, tx.transaction.msg.parent_id); }
    }
    return;
  }

}
Reddit.prototype.savePost = function savePost(tx) {

  // figure out what the URL is
  var myhref = tx.transaction.msg.link;
  if (myhref.indexOf("http://") != 0 && myhref.indexOf("https://") != 0) { myhref = "http://" + myhref; }

  var link   = new URL(myhref);

  var sql = "INSERT OR IGNORE INTO mod_reddit_posts (tx, votes, comments, post_id, reported, approved, subreddit, unixtime, unixtime_rank, url, domain) VALUES ($tx, 1, 0, $post_id, 0, 0, $subreddit, $unixtime, $unixtime_rank, $url, $domain)";
console.log(sql);
  this.app.storage.queryDatabase(sql, {
    $tx: JSON.stringify(tx.transaction),
    $post_id: tx.transaction.sig,
    $subreddit: tx.transaction.msg.subreddit,
    $unixtime: tx.transaction.ts,
    $unixtime_rank: tx.transaction.ts,
    $url : link.href,
    $domain : link.hostname
  }, function(err, row) {});
}
Reddit.prototype.saveComment = function saveComment(tx, post_id, parent_id) {
  var reddit_self = this;
  var sql = "INSERT OR IGNORE INTO mod_reddit_comments (tx, votes, post_id, reported, approved, comment_id, parent_id, unixtime) VALUES ($tx, 1, $post_id, 0, 0, $comment_id, $parent_id, $unixtime)";
  this.app.storage.queryDatabase(sql, {
    $tx: JSON.stringify(tx.transaction),
    $post_id: post_id,
    $comment_id: tx.transaction.sig,
    $parent_id: parent_id,
    $unixtime: tx.transaction.ts
  }, function(err, row) {

    var sql2 = "UPDATE mod_reddit_posts SET comments = comments + 1 WHERE post_id = $pid";
    var params2 = { $pid : post_id };
    reddit_self.app.storage.queryDatabase(sql2, params2, function(){});

  });
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

  if (app == null) { app = this.app; }

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
    if (publickey.indexOf("@") > 0) {} else {
      return 1;
    }
  }
  return 0;
}






