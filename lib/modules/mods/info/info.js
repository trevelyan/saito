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

  info_self = this;

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

    bid = req.query.bid;
    if (bid == null) {

      res.setHeader('Content-type', 'text/html');
      res.charset = 'UTF-8';
      res.write("NO BLOCK FOUND: ");
      res.write(req.query.bid);
      res.end();
      return;

    } else {

      sql    = "SELECT * FROM blocks WHERE block_id = $id";
      params = { $id : bid }; 

      app.storage.queryBlockchain(sql, params, function(err, row) {

	if (row == null) {

          res.setHeader('Content-type', 'text/html');
          res.charset = 'UTF-8';
          res.write("NO BLOCK FOUND: ");
          res.write(req.query.bid);
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
  });
  expressapp.get('/info/transaction', function (req, res) {

    tid = req.query.tid;
    if (tid == null) {

      res.setHeader('Content-type', 'text/html');
      res.charset = 'UTF-8';
      res.write("NO TRANSACTION FOUND: ");
      res.write(req.query.tid);
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
          res.write(req.query.bid);
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
      res.write(req.query.add);
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
          res.write(req.query.add);
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
      Server Public Key: '+app.wallet.returnPublicKey()+' \
      <br /> \
      Server Identifier: '+app.wallet.returnIdentifier()+' \
      <p></p> \
      Blockchain Info: \
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
      '+tmpblk.debugHTML()+ ' \
    </div> \
\
</body> \
</html>';

  return returnHTML;

}
Info.prototype.returnTransactionHTML = function returnTransactionHTML(txjson) {

  tmptx = new saito.transaction(txjson);

console.log("HERE: ");
console.log(tmptx);

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
      <table> \
        <tr> \
	  <th>Address</th> \
	  <th>Amount</th> \
	  <th>Block ID</th> \
	  <th>Transaction ID</th> \
	  <th>Spent</th> \
	</tr>';

    for (adr = 0; adr < addressdbrow.length; adr++) {
returnHTML += '<tr>';
returnHTML += '<td>'+addressdbrow[adr].address+'</td>';
returnHTML += '<td>'+addressdbrow[adr].amount+'</td>';
returnHTML += '<td>'+addressdbrow[adr].block_id+'</td>';
returnHTML += '<td>'+addressdbrow[adr].tx_id+'</td>';
returnHTML += '<td>'+addressdbrow[adr].spent+'</td>';
returnHTML += '</tr>';
    }
    
    console.log(addressdbrow);


returnHTML += ' \
      </tabl> \
   </div> \
\
</body> \
</html>';

  return returnHTML;

}







