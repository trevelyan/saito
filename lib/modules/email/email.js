var saito = require('../../saito');
var ModTemplate = require('../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Email(app) {

  if (!(this instanceof Email)) { return new Email(app); }
  Email.super_.call(this);

  this.app             = app;
  this.name            = "Email";
  this.supportsEmailInterface = 1;   // we have an email module
  return this;

}
module.exports = Email;
util.inherits(Email, ModTemplate);










////////////////////
// Install Module //
////////////////////
Email.prototype.installModule = function installModule() {

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_emails (\
                id INTEGER, \
                from TEXT, \
                to TEXT, \
                email TEXT, \
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
Email.prototype.onConfirmation = function onConfirmation(tx, conf, app) {

  if (tx.transaction.to[0].returnAddress() != app.wallet.returnPublicKey()) { return; }

  // email is zero-conf
  if (conf == 0) {

    if (app.BROWSERIFY == 0) { return; }

    // "this" is technically the array that calls us, so we have
    // to use a roundabout way of accessing the functions in our
    // email module in the onConfirmation function.
    //
    // note also that we check to be sure this is a new message
    // as most servers will send a couple of the most recent 
    // blocks on connection so that we don't start our own 
    // chain and follow it out of ignorance.
    //
    app.storage.ifNewMessage(tx, function(tx) {
      app.modules.returnModule("Email").addMessageToInbox(tx, app);
      app.storage.saveMessage(tx);
    });

  }

}




/////////////////////////////
// Display User Input Form //
/////////////////////////////
Email.prototype.displayUserInputForm = function displayUserInputForm(app) {

  element_to_edit = $('#module_editable_space');
  element_to_edit_html = '<input type="text" class="email_title" id="email_title" value="new email" /><p></p><textarea class="email_body" id="email_body" name="email_body"></textarea>';
  element_to_edit_css  = '<style>.email{width:100%;height:300px;padding:4px;} .email_title{margin-top:15px;width:100%;padding:5px;font-size:1.2em;} .email_body { width:100%;height:300px;font-size:1.2em;padding:5px; } </style>';
  element_to_edit.html(element_to_edit_html + element_to_edit_css);

}







/////////////////////
// Display Message //
/////////////////////
Email.prototype.displayMessage = function displayMessage(message_id, app) {

  if (app.BROWSERIFY == 1) {

    // json is simply email content in basic email module
    message_text_selector = "#" + message_id + " > .json";
    emailbody = $(message_text_selector).html();

    // json is simply email content in basic email module
    message_text_selector = "#" + message_id + " > .title";
    emailtitle = $(message_text_selector).text();

    // update title
    inserthtml = '<div class="message_title">'+emailtitle+'</div><div class="message_body">'+emailbody+'</div>';
    insertcss = '<style type="text/css">.message_title {font-weight: bold; margin-bottom: 20px; font-size:1.2em; margin-top:10px; } .message_body {}</style>';
    $('#lightbox_message_text').html(inserthtml + insertcss);

  }

}







////////////////////////
// Format Transaction //
////////////////////////
Email.prototype.formatTransaction = function formatTransaction(tx, app) {

  // always set the message.module to the name of the app
  tx.transaction.msg.module = this.name;
  tx.transaction.msg.body  = $('#email_body').val();
  tx.transaction.msg.title  = $('#email_title').val();

  return tx;

}






//////////////////////////
// Add Message To Inbox //
//////////////////////////
Email.prototype.addMessageToInbox = function addMessageToInbox(tx, app) {

    // fetch data from app
    msg = {};
    msg.id     = tx.transaction.id;
    msg.time   = tx.transaction.ts;
    msg.from   = tx.transaction.from[0].returnAddress();
    msg.module = tx.transaction.msg.module;
    msg.title  = tx.transaction.msg.title;
    msg.json   = tx.transaction.msg.body;

    this.attachMessage(msg, app);

}





/////////////////////////
// Handle Web Requests //
/////////////////////////
Email.prototype.webServer = function webServer(app, expressapp) {


  ///////////////////
  // web resources //
  ///////////////////
  expressapp.get('/email/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/email/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });


}







///////////////////
// Attach Events //
///////////////////
Email.prototype.attachEvents = function attachEvents(app) {

      if (app.BROWSERIFY == 0) { return; }

      email_self = this;

      $('#lightbox_compose_module_select').off();
      $('#lightbox_compose_module_select').on('change', function() {
        modsel = $('#lightbox_compose_module_select').val();
	$('.lightbox_compose_address_area').show();
        app.modules.displayUserInputForm(modsel);
      });



      $('#resync_button').off();
      $('#resync_button').on('click', function() {
	alert("Resyncing BLockchain from Scatch");
        app.blockchain.resetBlockchain();
      });

      $('#reset_button').off();
      $('#reset_button').on('click', function() {
        app.storage.saveOptions(1); // 1 = reset to virgin state
      });



      $('#mail_controls_delete').off('click');
      $('#mail_controls_delete').on('click', function() {
        $('.check:checked').each(function() {

	  id = $(this).attr('id');
          trclass = id.substring(0, id.length-9);
	  msg_id  = trclass.substring(8);
          domobj = "#"+trclass; 
	  app.storage.removeMessage(msg_id);
          $(domobj).remove();

        });
      });



      $('#compose').off();
      $('#compose').on('click', function() {
        $.fancybox({
          href            : '#lightbox_compose',
          fitToView       : false,
          width           : '1000px',
          height          : '600px',
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
           $('#send').off();
           $('#send').on('click', function() {

             to        = $('#lightbox_compose_to_address').val();
             from      = $('#lightbox_compose_from_address').val();
             amount    = $('#lightbox_compose_payment').val();
             fee       = $('#lightbox_compose_fee').val();

	     total_saito_needed = parseFloat(amount)+parseFloat(fee);

	     if (total_saito_needed > 0.0) {
	       if (app.wallet.returnBalance() <= total_saito_needed) {
		 alert("Your wallet does not have enough funds: "+ total_saito_needed + " -- " + app.wallet.returnBalance());
		 return;
	       }
	     }

	     // strip whitespace
	     to.trim(); from.trim();
	     // if this is not a public key


             // NON-PUBLIC KEY ADDRESSES MUST BE HANDLED BY MODULES
	     if (to.indexOf("@saito") > 0) {
	
		// try to fetch local copy
		pk = app.dns.returnPublicKey(to);

                if (pk == "") {

		  // fetch publickey before sending

		  app.dns.fetchRecordFromAppropriateServer(to, function(answer) {

		    if (answer == "") { 
		      alert("Unable to find public key for this address in blockchain DNS records: perhaps you need to connect to a server that is tracking this domain?");
		    } else {
	
		      publickeyaddress = answer;

		      // send email using local publickey
                      newtx = app.wallet.createUnsignedTransactionWithFee(publickeyaddress, amount, fee);
                      modsel = $('#lightbox_compose_module_select').val();
                      newtx = app.modules.formatTransaction(newtx, modsel);
                      newtx = app.wallet.signTransaction(newtx);
                      app.network.propagateTransaction(newtx);
                      email_self.showBrowserAlert("your message has been broadcast to the network");

                      $.fancybox.close();

		    }

		  });


                } else {

		  // send email using local publickey
		  to = pk;
                  newtx = app.wallet.createUnsignedTransactionWithFee(to, amount, fee);
                  modsel = $('#lightbox_compose_module_select').val();
                  newtx = app.modules.formatTransaction(newtx, modsel);
                  newtx = app.wallet.signTransaction(newtx);
                  app.network.propagateTransaction(newtx);
                  email_self.showBrowserAlert("your message has been broadcast to the network");

                  $.fancybox.close();

		}

	     } else {

	       // send email using provided publickey
               newtx = app.wallet.createUnsignedTransactionWithFee(to, amount, fee);
               modsel = $('#lightbox_compose_module_select').val();
               newtx = app.modules.formatTransaction(newtx, modsel);
               newtx = app.wallet.signTransaction(newtx);
               app.network.propagateTransaction(newtx);
               email_self.showBrowserAlert("your message has been broadcast to the network");

               $.fancybox.close();

             }
           });
          },
        });
      });


      $('#mail_controls_settings').off();
      $('#mail_controls_settings').on('click', function() {
        $.fancybox({
          href            : '#lightbox_viewkeys',
          fitToView       : false,
          width           : '1000px',
          height          : '600px',
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
	  afterShow : function() {

            // customize dns settings display
            for (c = 0; c < app.dns.dns.domains.length; c++) {
              dnsurl = "unknown";
              for (cvs = 0; cvs < app.network.peers.length; cvs++) {
                if (app.dns.dns.domains[c].publickey == app.network.peers[cvs].peer.publickey) {
	          dnsurl = app.network.peers[cvs].peer.host;
	        }
              }
              tmphtml = '<tr><td>'+app.dns.dns.domains[c].domain+'</td><td>'+dnsurl+'</td><td>'+app.dns.dns.domains[c].publickey+'</td></tr>';
              $('#dns_servers_table tr:last').after(tmphtml);
            };



	    $('#lightbox_viewkeys_submit_identifier_button').off();
	    $('#lightbox_viewkeys_submit_identifier_button').on('click', function() {

	      myaddress = $('#lightbox_viewkeys_submit_identifier').val();

   	      app.dns.fetchRecordFromAppropriateServer(myaddress, function(answer) {

	 	if (answer == email_self.app.wallet.returnPublicKey()) {
		  email_self.app.dns.addKey(myaddress, answer);
		  alert("Success: your DNS provider confirmed this address is yours");
		  $.fancybox.close();
	 	} else {
		  alert("Failure: your DNS provider does not recognize this identifier as belonging to your account. If you just submitted your request in the blockchain, please wait for email confirmation before registering the account with your browser: "+answer);
		}

	      });

	    });

	  }
        });
      });





      $('.inner_message').off();
      $('.inner_message').on('click', function() {

        // update message box
        message_id    = $(this).attr('id');
        message_class = $(this).attr('class');

        message_text_selector = "#" + message_id + " > .from";
        $('#lightbox_message_from_address').text( email_self.formatAuthor($(message_text_selector).text()));

        message_text_selector = "#" + message_id + " > .to";
        $('#lightbox_message_to_address').text( email_self.formatAuthor(app.wallet.returnPublicKey()) );

        message_text_selector = "#" + message_id + " > .module";
        console.log(message_text_selector);
        module = $(message_text_selector).text();
        console.log(module);


        app.modules.displayMessage(message_id, module);


        $('#compose').click();

        $.fancybox({
          href            : '#lightbox_message',
          fitToView       : false,
          width           : '1000px',
          height          : '600px',
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


	    // attach events to email contents
            email_self.app.modules.returnModule(module).attachEvents(app);

            $('#reply').off();
            $('#reply').on('click', function() {

              // close fancybox
              $.fancybox.close();
              // update compose message box
              $('#lightbox_compose_from_address').val( $('#lightbox_message_to_address').text() );
              $('#lightbox_compose_to_address').val( $('#lightbox_message_from_address').text() );
              $('#lightbox_compose_textarea').val("");
              $('#compose').click();

           });
          },
        });
      });


      // unbind the checkboxs
      $('.checkbox').off('click');

}





Email.prototype.initializeHTML = function initializeHTML(app) {

    // update wallet balance
    this.updateBalance(app);


    // customize module display
    selobj = $('#lightbox_compose_module_select');
    selobj.empty();
    for (c = 0; c < app.modules.mods.length; c++) {
        if (app.modules.mods[c].supportsEmailInterface == 1) {
          selmod = '<option value="'+app.modules.mods[c].name+'">'+app.modules.mods[c].name+'</option>';
          selobj.append(selmod);
        }
    };


    // default to our mail client
    this.displayUserInputForm();


    // update the default FROM address to our own, to address blank
    $('#lightbox_compose_from_address').val(app.wallet.returnPublicKey());
    $('#lightbox_compose_to_address').val("");

    this.attachEvents(app);


    // tell the browser what our public/private keys look like
    $('#lightbox_viewkeys_publickey').html(app.wallet.returnPublicKey());
    $('#lightbox_viewkeys_privatekey').html(app.wallet.returnPrivateKey());





    // social network
    for (c = 0; c < app.options.friends.length; c++) {
      tmphtml = '<tr><td>'+app.options.friends[c].identifier+'</td><td>'+app.options.friends[c].publickey+'</td></tr>';
      $('#friends_table tr:last').after(tmphtml);
    }




    // load saved messages into email client
console.log("LENGTH OF MESSAGES: ");
console.log(app.options.messages.length);
console.log(app.options.messages);

    for (ii = 0; ii < app.options.messages.length; ii++) {
console.log("LOADING: ");
console.log(app.options.messages[ii]);

      tx = new saito.transaction(app.options.messages[ii]);
      if (tx.transaction.msg.module != "") {
        txmod = tx.transaction.msg.module;
        this.addMessageToInbox(tx, app);
      }
    }

}






Email.prototype.updateBalance = function updateBalance(app) {
    $('#balance_money').html(app.wallet.returnBalance());
}

Email.prototype.showBrowserAlert = function showBrowserAlert(message="your message has been broadcast to the network") {

  $('#mail_controls_message').text(message);
  $('#mail_controls_message').show();
  $('#mail_controls_message').fadeOut(2000, function() {});

}


Email.prototype.attachMessage = function attachMessage(message, app) {

      if (app.BROWSERIFY == 0) { return; }

      var newrow = '    <tr class="outer_message" id="message_'+message.id+'"> \
                          <td class="checkbox"><input type="checkbox" class="check" name="" id="message_'+message.id+'_checkbox" /></td> \
                          <td> \
                            <table style="border:0px"> \
                              <tr class="inner_message" id="message_'+message.id+'"> \
                                <td class="from">'+this.formatAuthor(message.from)+'</td> \
                                <td class="title">'+message.title+'</td> \
                                <td class="time">'+message.time+'</td> \
                                <td class="module" style="display:none">'+message.module+'</td> \
                                <td class="json" style="display:none">'+message.json+'</td> \
                              </tr> \
                            </table> \
                          </td> \
                        </tr>';
      $('.message_table').prepend(newrow);

     this.attachEvents(app);

}















Email.prototype.formatDate = function formateDate(unixtime) {

  x = new Date(unixtime);
  return x.getDate() + " / " + (x.getMonth()+1) + " / " + x.getFullYear();

}

Email.prototype.formatAuthor = function formatAuthor(author, app) {

  x = this.app.dns.returnIdentifier(author);
  if (x != "") { return x; }

  x = this.app.friends.findByPublicKey(author);
  if (x != null) { return x.identifier; }

  return author;

}






