var saito       = require('../../../saito');
var ModTemplate = require('../../template');
var util        = require('util');
var fs          = require('fs');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Info(app) {

  if (!(this instanceof Info)) { return new Info(app); }
  Info.super_.call(this);

  this.app             = app;
  this.name            = "Info";

  return this;

}
module.exports = Info;
util.inherits(Info, ModTemplate);





/////////////////////////
// Handle Web Requests //
/////////////////////////
Info.prototype.webServer = function webServer(app, expressapp) {

  var info_self = this;

  ///////////////////
  // web resources //
  ///////////////////
  expressapp.get('/info/', function (req, res) {
    //rewrite indexHTML page
    fs.writeFileSync((__dirname + "/web/index.html"), info_self.returnIndexHTML(app), function(err) {
      if (err) {
        return console.log(err);
      }
    });
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/info/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });
  expressapp.get('/info/block', function (req, res) {

    bid  = req.query.bid;
    hash = req.query.hash;

    if (bid == null && hash == null) {

      res.setHeader('Content-type', 'text/html');
      res.charset = 'UTF-8';
      res.write("NO BLOCK FOUND: ");
      res.end();
      return;

    } else {

      if (bid != null) {

        sql    = "SELECT * FROM blocks WHERE block_id = $id";
        params = { $id : bid }; 

        app.storage.queryBlockchain(sql, params, function(err, row) {

	  if (row == null) {

            res.setHeader('Content-type', 'text/html');
            res.charset = 'UTF-8';
            res.write("NO BLOCK FOUND: ");
            res.end();
            return;

  	  } else {

            res.setHeader('Content-type', 'text/html');
            res.charset = 'UTF-8';
            res.write(info_self.returnBlockHTML(info_self.app, row.block));
            res.end();
            return;

          }
        });
      }

      if (hash != null) {

        sql    = "SELECT * FROM blocks WHERE hash = $hash";
        params = { $hash : hash }; 

        app.storage.queryBlockchain(sql, params, function(err, row) {

	  if (row == null) {

            res.setHeader('Content-type', 'text/html');
            res.charset = 'UTF-8';
            res.write("NO BLOCK FOUND: ");
            res.end();
            return;

  	  } else {

            res.setHeader('Content-type', 'text/html');
            res.charset = 'UTF-8';
            res.write(info_self.returnBlockHTML(info_self.app, row.block));
            res.end();
            return;

          }
        });
      }
    }
  });
  expressapp.get('/info/transaction', function (req, res) {

    tid = req.query.tid;
    if (tid == null) {

      res.setHeader('Content-type', 'text/html');
      res.charset = 'UTF-8';
      res.write("NO TRANSACTION FOUND: ");
      res.end();
      return;

    } else {

      sql    = "SELECT * FROM txs WHERE tx_id = $id";
      params = { $id : tid }; 

      app.storage.queryBlockchain(sql, params, function(err, row) {

	if (row == null) {

          res.setHeader('Content-type', 'text/html');
          res.charset = 'UTF-8';
          res.write("NO TRANSACTION FOUND: ");
          res.end();
          return;

	} else {

          res.setHeader('Content-type', 'text/html');
          res.charset = 'UTF-8';
          res.write(info_self.returnTransactionHTML(row.tx));
          res.end();
          return;

        }
      });
    }
  });
  expressapp.get('/info/address', function (req, res) {

    add = req.query.add;
    if (add == null) {

      res.setHeader('Content-type', 'text/html');
      res.charset = 'UTF-8';
      res.write("NO ADDRESS FOUND: ");
      res.end();
      return;

    } else {

      sql    = "SELECT * FROM slips WHERE address = $add";
      params = { $add : add }; 

      app.storage.queryBlockchainArray(sql, params, function(err, rows) {

	if (rows == null) {

          res.setHeader('Content-type', 'text/html');
          res.charset = 'UTF-8';
          res.write("NO ADDRESS FOUND: ");
          res.end();
          return;

	} else {

          res.setHeader('Content-type', 'text/html');
          res.charset = 'UTF-8';
          res.write(info_self.returnAddressHTML(rows));
          res.end();
          return;

        }
      });
    }
  });

}




Info.prototype.returnIndexHTML = function returnIndexHTML(app) {

return '<html> \
<head> \
  <meta charset="utf-8"> \
  <meta http-equiv="X-UA-Compatible" content="IE=edge"> \
  <meta name="viewport" content="width=device-width, initial-scale=1"> \
  <meta name="description" content=""> \
  <meta name="author" content=""> \
  <title>Saito Network: Blockchain Explorer</title> \
  <link rel="stylesheet" type="text/css" href="/info/style.css" /> \
</head> \
<body> \
\
    <div class="header"> \
      <a href="/" style="text-decoration:none;color:inherits"> \
        <img src="/img/saito_logo_black.png" style="width:35px;margin-top:5px;margin-left:25px;margin-right:10px;float:left;" /> \
        <div style="font-family:Georgia;padding-top:0px;font-size:1.2em;color:#444;">saito</div> \
      </a> \
    </div> \
\
    <div class="main"> \
      Search for Block (by hash): \
      <p></p> \
      <form method="get" action="/info/block"><input type="text" name="hash" class="hash_search_input" /><br /><input type="submit" class="hash_search_submit" value="search" /></form> \
      <p></p> \
      <u>Recent Blocks:</u> \
      <p></p> \
      '+app.blockchain.debugHTML()+' \
    </div> \
\
</body> \
</html>';

}
Info.prototype.returnBlockHTML = function returnBlockHTML(app, blockjson) {

  tmpblk = new saito.block(app, blockjson);

returnHTML = '<html> \
<head> \
  <meta charset="utf-8"> \
  <meta http-equiv="X-UA-Compatible" content="IE=edge"> \
  <meta name="viewport" content="width=device-width, initial-scale=1"> \
  <meta name="description" content=""> \
  <meta name="author" content=""> \
  <title>Saito Network: Blockchain Explorer: Block</title> \
  <link rel="stylesheet" type="text/css" href="/info/style.css" /> \
</head> \
<body> \
\
    <div class="header"> \
      <a href="/" style="text-decoration:none;color:inherits"> \
        <img src="/img/saito_logo_black.png" style="width:35px;margin-top:5px;margin-left:25px;margin-right:10px;float:left;" /> \
        <div style="font-family:Georgia;padding-top:0px;font-size:1.2em;color:#444;">saito</div> \
      </a> \
    </div> \
\
    <div class="main"> \
	<b>Block Information:</b> \
	<p></p> \
      '+tmpblk.debugHTML()+ ' \
    </div> \
\
</body> \
</html>';

  return returnHTML;

}
Info.prototype.returnTransactionHTML = function returnTransactionHTML(txjson) {

  tmptx = new saito.transaction(txjson);

returnHTML = '<html> \
<head> \
  <meta charset="utf-8"> \
  <meta http-equiv="X-UA-Compatible" content="IE=edge"> \
  <meta name="viewport" content="width=device-width, initial-scale=1"> \
  <meta name="description" content=""> \
  <meta name="author" content=""> \
  <title>Saito Network: Blockchain Explorer: Transaction</title> \
  <link rel="stylesheet" type="text/css" href="/info/style.css" /> \
</head> \
<body> \
\
    <div class="header"> \
      <a href="/" style="text-decoration:none;color:inherits"> \
        <img src="/img/saito_logo_black.png" style="width:35px;margin-top:5px;margin-left:25px;margin-right:10px;float:left;" /> \
        <div style="font-family:Georgia;padding-top:0px;font-size:1.2em;color:#444;">saito</div> \
      </a> \
    </div> \
\
    <div class="main"> \
	<b>Transaction Information:</b> \
	<p></p> \
      '+tmptx.debugHTML()+ ' \
    </div> \
\
</body> \
</html>';

  return returnHTML;

}
Info.prototype.returnAddressHTML = function returnAddressHTML(addressdbrow) {

returnHTML = '<html> \
<head> \
  <meta charset="utf-8"> \
  <meta http-equiv="X-UA-Compatible" content="IE=edge"> \
  <meta name="viewport" content="width=device-width, initial-scale=1"> \
  <meta name="description" content=""> \
  <meta name="author" content=""> \
  <title>Saito Network: Blockchain Explorer: Transaction</title> \
  <link rel="stylesheet" type="text/css" href="/info/style.css" /> \
</head> \
<body> \
\
    <div class="header"> \
      <a href="/" style="text-decoration:none;color:inherits"> \
        <img src="/img/saito_logo_black.png" style="width:35px;margin-top:5px;margin-left:25px;margin-right:10px;float:left;" /> \
        <div style="font-family:Georgia;padding-top:0px;font-size:1.2em;color:#444;">saito</div> \
      </a> \
    </div> \
\
    <div class="main"> \
	<b>Address Information</b> \
	<p></p> \
      <table class="address_table"> \
        <tr> \
	  <th>address</th> \
	  <th>amount</th> \
	  <th>block id</th> \
	  <th>transaction id</th> \
	</tr>';

    for (adr = 0; adr < addressdbrow.length; adr++) {
      if (addressdbrow[adr].spent == 0 && addressdbrow[adr].amount > 0) {
        returnHTML += '<tr>';
        returnHTML += '<td>'+addressdbrow[adr].address+'</td>';
        returnHTML += '<td>'+addressdbrow[adr].amount+'</td>';
        returnHTML += '<td><a href="/info/block?bid='+addressdbrow[adr].block_id+'">'+addressdbrow[adr].block_id+'</a></td>';
        returnHTML += '<td><a href="/info/transaction?tid='+addressdbrow[adr].tx_id+'">'+addressdbrow[adr].tx_id+'</a></td>';
        returnHTML += '</tr>';
      }
    }
    
returnHTML += ' \
      </tabl> \
   </div> \
\
</body> \
</html>';

  return returnHTML;

}







