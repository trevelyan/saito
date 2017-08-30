var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Email(app) {

  if (!(this instanceof Email)) { return new Email(app); }

  Email.super_.call(this);

  this.app             = app;

  this.name            = "Email";
  this.browser_active  = 0;
  this.handlesEmail    = 1;
  return this;

}
module.exports = Email;
util.inherits(Email, ModTemplate);









/////////////////////////
// Handle Web Requests //
/////////////////////////
Email.prototype.webServer = function webServer(app, expressapp) {

  expressapp.get('/email/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/email/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });

}







////////////////////////
// Display Email Form //
////////////////////////
Email.prototype.resetEmailForm = function resetEmailForm() {
  $('.lightbox_compose_address_area').show();
  $('.lightbox_compose_module').show();
  $('#send').show();
}
Email.prototype.displayEmailForm = function displayEmailForm(app) {

  element_to_edit = $('#module_editable_space');
  element_to_edit_html = '<input type="text" class="email_title" id="email_title" value="new email" /><p></p><textarea class="email_body" id="email_body" name="email_body"></textarea>';
  element_to_edit_css  = '<style>.email{width:100%;height:355px;padding:4px;} .email_title{margin-top:15px;width:100%;padding:5px;font-size:1.2em;} .email_body { width:100%;height:355px;font-size:1.2em;padding:5px; } </style>';
  element_to_edit.html(element_to_edit_html + element_to_edit_css);

}

/////////////////////
// Display Message //
/////////////////////
Email.prototype.displayEmailMessage = function displayEmailMessage(message_id, app) {

  if (app.BROWSER == 1) {

    message_text_selector = "#" + message_id + " > .data";
    emailbody = $(message_text_selector).html();

    message_text_selector = "#" + message_id + " > .title";
    emailtitle = $(message_text_selector).text();

    inserthtml = '<div class="message_title">'+emailtitle+'</div><div class="message_body">'+emailbody+'</div>';
    insertcss = '<style type="text/css">.message_title {font-weight: bold; margin-bottom: 20px; font-size:1.2em; margin-top:10px; } .message_body {}</style>';
    $('#lightbox_message_text').html(inserthtml + insertcss);

  }

}

////////////////////////
// Format Transaction //
////////////////////////
Email.prototype.formatEmailTransaction = function formatEmailTransaction(tx, app) {

  // always set the message.module to the name of the app
  tx.transaction.msg.module = this.name;
  tx.transaction.msg.data  = $('#email_body').val();
  tx.transaction.msg.title  = $('#email_title').val();

  return tx;

}









////////////////////////
// Load from Archives //
////////////////////////
Email.prototype.loadFromArchives = function loadFromArchives(app, tx) {
  this.addMessageToInbox(tx, app);
}












//////////////////
// Confirmation //
//////////////////
Email.prototype.onConfirmation = function onConfirmation(tx, conf, app) {

  if (tx.transaction.msg.module != "Email") { return; }

  if (tx.transaction.to[0].add != app.wallet.returnPublicKey()) { return; }



  // email is zero-conf
  if (conf == 0) {
    if (tx.transaction.msg.module = "Email") {

      if (app.BROWSER == 1) {
        app.modules.returnModule("Email").addMessageToInbox(tx, app);
      }

      app.archives.saveMessage(tx);
    }
  }

}













//////////////////////////
// Add Message To Inbox //
//////////////////////////
Email.prototype.addMessageToInbox = function addMessageToInbox(tx, app) {

    if (app.BROWSER == 0) { return; }

    // fetch data from app
    msg = {};
    msg.id     = tx.transaction.id;
    msg.time   = tx.transaction.ts;
    msg.from   = tx.transaction.from[0].add;
    msg.module = tx.transaction.msg.module;
    msg.title  = tx.transaction.msg.title;
    msg.data   = tx.transaction.msg.data;

    // check comment does not already exist
    tocheck = "#message_"+msg.id;
    if ($(tocheck).length > 0) { return; }

    this.attachMessage(msg, app);

}








///////////////////
// Attach Events //
///////////////////
Email.prototype.attachEvents = function attachEvents(app) {

      if (app.BROWSER == 0) { return; }
 
      email_self = this;

      $('#lightbox_compose_module_select').off();
      $('#lightbox_compose_module_select').on('change', function() {
        modsel = $('#lightbox_compose_module_select').val();
        app.modules.displayEmailForm(modsel);
      });


      $('#save_wallet').off();
      $('#save_wallet').on('click', function() {
	content    = JSON.stringify(app.options);
        var pom = document.createElement('a');
            pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
            pom.setAttribute('download', "saito.wallet.json");
	    pom.click();
      });


      $('#import_wallet').off();
      $('#import_wallet').on('click', function() {
        document.getElementById('file-input').addEventListener('change', function(e) { 
  	  var file = e.target.files[0];
  	  if (!file) { return; }
	  var reader = new FileReader();
	  reader.onload = function(e) {
	    var contents = e.target.result;
	    tmpoptions = JSON.parse(contents);
	    if (tmpoptions.wallet.publickey != null) { 
	      email_self.app.options = JSON.parse(contents);
	      email_self.app.storage.saveOptions();
	    } else {
	      alert("This does not seem to be a valid wallet file");
	    }
	  };
	  reader.readAsText(file);
	}, false);
        $('#file-input').trigger('click');
      });


      $('#save_messages').off();
      $('#save_messages').on('click', function() {
	content    = JSON.stringify(app.options);
        var pom = document.createElement('a');
            pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
            pom.setAttribute('download', "saito.messages.json");
	    pom.click();
      });


      $('#import_messages').off();
      $('#import_messages').on('click', function() {
        document.getElementById('file-input').addEventListener('change', function(e) { 
  	  var file = e.target.files[0];
  	  if (!file) { return; }
	  var reader = new FileReader();
	  reader.onload = function(e) {
	    var contents = e.target.result;
	    email_self.app.archives.resetArchives();
            tmpmessages = JSON.parse(contents);
	    if (tmpmessages.messages.length != null) { 
  	      for (xx = 0; xx < tmpmessages.length; xx++) {
	        email_self.app.archives.saveMessage(tmpmessages[xx]);
	      }
            } else {
	      alert("Error: this is not a valid inbox backup");
	    }
	  };
	  reader.readAsText(file);
	}, false);
        $('#file-input').trigger('click');
      });


      $('#save_messages').off();
      $('#save_messages').on('click', function() {
	content    = JSON.stringify(app.archives.messages);
        var pom = document.createElement('a');
            pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
            pom.setAttribute('download', "saito.messages.json");
	    pom.click();
      });


      $('#reset_button').off();
      $('#reset_button').on('click', function() {
        app.storage.saveOptions(1); // 1 = reset to virgin state
        app.archives.resetArchives();
	alert("Your account has been reset");
	location.reload();
      });


      $('#mail_controls_delete').off('click');
      $('#mail_controls_delete').on('click', function() {
        $('.check:checked').each(function() {

	  id = $(this).attr('id');
          trclass = id.substring(0, id.length-9);
	  msg_id  = trclass.substring(8);
          domobj = "#"+trclass; 
	  app.archives.removeMessage(msg_id);
          $(domobj).remove();

        });
      });



      $('#compose').off();
      $('#compose').on('click', function() {

	$('.lightbox_compose_module_select').val("Email");
	$('.lightbox_compose_payment').val(0.0);
	email_self.resetEmailForm();
        app.modules.displayEmailForm("Email");

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
		pk = app.keys.returnPublicKeyByIdentifier(to);

                if (pk == "") {

		  // fetch publickey before sending

		  app.dns.fetchRecordFromAppropriateServer(to, function(answer) {

		    if (answer == "identifier not found") { 
		      email_self.showBrowserAlert("ERROR: DNS server cannot find record");
		      return;
		    }
		    if (answer == "server not found") { 
		      email_self.showBrowserAlert("ERROR: cannot find DNS server");
		      return;
		    }
		    if (answer == "no dns servers") { 
		      email_self.showBrowserAlert("ERROR: cannot send email -- no DNS servers");
		      return;
		    }
		    if (answer == "dns server publickey changed") { 
		      email_self.showBrowserAlert("ERROR: cannot send email -- DNS server publickey wrong");
		      return;
		    }
		    if (answer == "") { 
		      alert("Unable to find public key for this address in blockchain DNS records: perhaps you need to connect to a server that is tracking this domain?");
		      return;
		    }

		    publickeyaddress = answer;

		    // add to our list of keys, email ones don't need watching
		    email_self.app.keys.addKey(publickeyaddress, to, 0);


		    // send email using local publickey
                    newtx = app.wallet.createUnsignedTransactionWithFee(publickeyaddress, amount, fee);
                    modsel = $('#lightbox_compose_module_select').val();
                    newtx = app.modules.formatEmailTransaction(newtx, modsel);
                    newtx = app.wallet.signTransaction(newtx);
                    app.network.propagateTransaction(newtx);
                    email_self.showBrowserAlert("your message has been broadcast to the network");

                    $.fancybox.close();

		  });


                } else {

		  // send email using local publickey
		  to = pk;
                  newtx = app.wallet.createUnsignedTransactionWithFee(to, amount, fee);
                  modsel = $('#lightbox_compose_module_select').val();
                  newtx = app.modules.formatEmailTransaction(newtx, modsel);
                  newtx = app.wallet.signTransaction(newtx);
                  app.network.propagateTransaction(newtx);
                  email_self.showBrowserAlert("your message has been broadcast to the network");

                  $.fancybox.close();

		}

	     } else {

	       // send email using provided publickey
               newtx = app.wallet.createUnsignedTransactionWithFee(to, amount, fee);
               modsel = $('#lightbox_compose_module_select').val();
               newtx = app.modules.formatEmailTransaction(newtx, modsel);
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

console.log("DNS MAGIC:");
console.log(app.dns.dns.domains);
console.log("DNS MAGIC 2:");
console.log(app.network.returnPeers());
console.log("done");

            // customize dns settings display
            $('#dns_servers_table tr').empty();
            for (c = 0; c < app.dns.dns.domains.length; c++) {
              tmphtml = '<tr><th align="left" style="padding-right:25px;">Domain</th><th align="left" style="padding-right:25px">Host</th><th align="left">Public Key</th></tr>';
              $('#dns_servers_table').append(tmphtml);
              dnsurl = "unknown";
              for (cvs = 0; cvs < app.network.peers.length; cvs++) {
                if (app.dns.dns.domains[c].publickey == app.network.peers[cvs].peer.publickey) {
	          dnsurl = app.network.peers[cvs].peer.host;
                  tmphtml = '<tr><td>'+app.dns.dns.domains[c].domain+'</td><td>'+dnsurl+'</td><td>'+app.dns.dns.domains[c].publickey+'</td></tr>';
                  $('#dns_servers_table tr:last').after(tmphtml);
	        }
              }
              if (dnsurl == "unknown") {
                tmphtml = '<tr><td style="padding-right:14px;">'+app.dns.dns.domains[c].domain+'</td><td style="padding-right:14px;">UNKNOWN</td><td style="padding-right:14px;">PUBLIC KEY OUT-OF-DATE</td></tr>';
                $('#dns_servers_table tr:last').after(tmphtml);
	      }
            };


	    // update identifier
	    if (email_self.app.wallet.returnIdentifier() != "") {
	      $('#lightbox_viewkeys_identifier').text(email_self.app.wallet.returnIdentifier());
            }




	    // update social network
	    watched = email_self.app.keys.returnPublicKeysWatchedArray();
	    for (c = 0; c < watched.length; c++) {
	      tmphtml = '<tr><td>'+watched[c].identifier+'</td><td>'+watched[c]+'</td></tr>';
	      $('#social_table tr:last').after(tmphtml);
	    }



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
        module = $(message_text_selector).text();

        app.modules.displayEmailMessage(message_id, module);
        app.modules.attachEmailEvents();

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

	    email_self = app.modules.returnModule("Email");

            // attach events to email contents
            email_self.attachEvents(app);

            $('#reply').off();
            $('#reply').on('click', function() {

	      email_self.resetEmailForm();

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




Email.prototype.attachEmailEvents = function attachEmailEvents() {

  email_self = this;

  if (this.app.BROWSER == 1) {

    // hack to make the default welcome email responsive
    $('.register_email_address').off();
    $('.register_email_address').on('click', function() {
      $.fancybox.close();
      $('#compose').click();
      $('.lightbox_compose_module_select').val("Registry");
      email_self.app.modules.returnModule("Registry").displayEmailForm(email_self.app);
    });   

    // hack to make identifier registration work
    $('.register_email_address_success').off();
    $('.register_email_address_success').on('click', function() {
      $.fancybox.close();
      email_self.app.dns.fetchIdFromAppropriateServer(email_self.app.wallet.returnPublicKey(), function (answer) {
        email_self.app.wallet.updateIdentifier(answer);
        email_self.app.wallet.saveWallet();
      });
    });   
  }

}




Email.prototype.initializeHTML = function initializeHTML(app) {

    email_self = this;

    // update wallet balance
    this.updateBalance(app);


    // customize module display
    selobj = $('#lightbox_compose_module_select');
    selobj.empty();
    for (c = 0; c < app.modules.mods.length; c++) {
        if (app.modules.mods[c].handlesEmail == 1) {
          selmod = '<option value="'+app.modules.mods[c].name+'">'+app.modules.mods[c].name+'</option>';
          selobj.append(selmod);
        }
    };


    // default to our mail client
    this.displayEmailForm();


    // update the default FROM address to our own, to address blank
    $('#lightbox_compose_from_address').val(app.wallet.returnPublicKey());
    $('#lightbox_compose_to_address').val("");

    this.attachEvents(app);


    // tell the browser what our public/private keys look like
    $('#lightbox_viewkeys_publickey').html(app.wallet.returnPublicKey());
    $('#lightbox_viewkeys_privatekey').html(app.wallet.returnPrivateKey());




    // load archived messages
    app.archives.processMessages(20, function (err, txarray) {
      for (bv = 0; bv < txarray.length; bv++) {
	if (txarray[bv].transaction.msg.module == "Email") {
          email_self.addMessageToInbox(txarray[bv], app);
	}
      }
    });

}






Email.prototype.updateBalance = function updateBalance(app) {
  if (app.BROWSER == 0) { return; }
  $('#balance_money').html(app.wallet.returnBalance().replace(/0+$/,'').replace(/\.$/,'\.0'));
}

Email.prototype.showBrowserAlert = function showBrowserAlert(message="your message has been broadcast to the network") {
  $('#mail_controls_message').text(message);
  $('#mail_controls_message').show();
  $('#mail_controls_message').fadeOut(2000, function() {});
}

Email.prototype.attachMessage = function attachMessage(message, app) {

      if (app.BROWSER == 0) { return; }

      var newrow = '    <tr class="outer_message" id="message_'+message.id+'"> \
                          <td class="checkbox"><input type="checkbox" class="check" name="" id="message_'+message.id+'_checkbox" /></td> \
                          <td> \
                            <table style="border:0px"> \
                              <tr class="inner_message" id="message_'+message.id+'"> \
                               <td class="from">'+this.formatAuthor(message.from, app)+'</td> \
                                <td class="title">'+message.title+'</td> \
                                <td class="time">'+this.formatDate(message.time)+'</td> \
                                <td class="module" style="display:none">'+message.module+'</td> \
                                <td class="data" style="display:none">'+message.data+'</td> \
                              </tr> \
                            </table> \
                          </td> \
                        </tr>';
      $('.message_table').prepend(newrow);

     this.attachEvents(app);

}















Email.prototype.formatDate = function formateDate(unixtime) {

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
      if (tmpmins < 10) {
        y = tmphour + ":0" + tmpmins + " "+am_or_pm;
      } else {
        y = tmphour + ":" + tmpmins + " "+am_or_pm;
      }

    }
  }

  return y;

}

Email.prototype.formatAuthor = function formatAuthor(author, app) {

  x = this.app.keys.findByPublicKey(author);
  if (x != null) { return x.identifier; }

  return author;

}




 

