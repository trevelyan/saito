var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var markdown = require( "markdown" ).markdown;

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
  this.emailAppName    = "Email";

  return this;

}
module.exports = Email;
util.inherits(Email, ModTemplate);




Email.prototype.initialize = function initialize(app) {

  if (app.BROWSER == 0) { return; }

  // remove us if mobile client is running
  if ($('#Email_browser_active').length == 0) {
    for (var t = app.modules.mods.length-1; t >= 0; t--) {
      if (app.modules.mods[t].name == "EmailMobile") {
        app.modules.mods.splice(t, 1);
      }
    }
  }

}






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
  element_to_edit_html = '<input type="text" class="email_title" id="email_title" value="" /><p></p><textarea class="email_body" id="email_body" name="email_body"></textarea>';
  element_to_edit_html += '<input type="hidden" name="email_attachment_content" id="email_attachment_content">';
  element_to_edit_html += '<input type="hidden" name="email_attachment_name" id="email_attachment_name">';
  element_to_edit_html += '<br /></hr /><br /><input type="file" name="email_attachment" id="email_attachment">';
  element_to_edit.html(element_to_edit_html);
  var code = "no content"
  $('#email_attachment').on('change',function() {
      console.log(this);
      var upload = this.files[0];
      $('#email_attachment_name').val(upload.name);
      var p = new Promise(function(resolve) {
          var reader = new FileReader();
          reader.onload = function() {
              code = reader.result;
                resolve($('#email_attachment_content').val(code));
              };
              reader.readAsDataURL(upload);
          });
    //console.log($("#email_attachment_content"));
    });
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

    message_text_selector = "#" + message_id + "_attachment";
    astring = $(message_text_selector).text();

    message_text_selector = "#" + message_id + "_attachment_name";
    aname = $(message_text_selector).text();

    inserthtml = '<div class="message_title">'+emailtitle+'</div><div class="message_body">'+emailbody+'</div>';
    //inserthtml += '<div class="message_attachment">'+emailattachment+'</div>';
    insertcss = '<style type="text/css">.message_title {font-weight: bold; margin-bottom: 20px; font-size:1.2em; margin-top:10px; } .message_body {} .message_attachment{overflow:auto;}</style>';
    $('#lightbox_message_text').html(inserthtml + insertcss);
    var element = document.createElement('a');
    element.setAttribute('href', astring);
    element.setAttribute('download', aname);
    element.setAttribute('id', 'attachment_dl');
    element.innerHTML = 'Download Attachment';
    $('#lightbox_message_text').append(element);
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
  tx.transaction.msg.attachment = $('#email_attachment_content').val();
  tx.transaction.msg.attachment_name = $('#email_attachment_name').val();

  // convert msg into encrypted string
  tmpmsg = app.keys.encryptMessage(tx.transaction.to[0].add, tx.transaction.msg);
  tx.transaction.msg = tmpmsg;

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
Email.prototype.onConfirmation = function onConfirmation(blk, tx, conf, app) {

  // we are expecting encrypted content, so check the auto-decrypt field
  if (tx.decrypted_msg.module != "Email") { return; }
  if (tx.transaction.to[0].add != app.wallet.returnPublicKey()) { return; }

  // email is zero-conf
  if (conf == 0) {
    if (tx.decrypted_msg.module = "Email") {
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

console.log("ADDING EMAIL TO INBOX!");
console.log(JSON.stringify(tx));

    if (app.BROWSER == 0) { return; }

    // fetch data from app
    msg = {};
    msg.id       = tx.transaction.id;
    msg.time     = tx.transaction.ts;
    msg.from     = tx.transaction.from[0].add;
    msg.module   = tx.decrypted_msg.module;
    msg.title    = tx.decrypted_msg.title;
    msg.data     = tx.decrypted_msg.data;
    msg.markdown = tx.decrypted_msg.markdown;
    msg.attachment = tx.decrypted_msg.attachment;
    msg.attachment_name = tx.decrypted_msg.attachment_name;
    //console.log(tx.decrypted_msg.attachment);
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

      var email_self = this;

      // insert templates
      app.browser.attachTemplateEvents("saito-desktop-settings", email_self);


      $('#lightbox_compose_to_address').off();
      $('#lightbox_compose_to_address').on('focus', function() {
	email_self.showEmailAlert();
	$('#lightbox_compose_to_address').css('color', '#000');
	$('#lightbox_compose_to_address').css('background-color', '#FFF');
	$('#lightbox_compose_from_address').css('color', '#000');
	$('#lightbox_compose_from_address').css('background-color', '#FFF');
      });
      $('#lightbox_compose_to_address').on('focusout', function() {

	$('#lightbox_compose_to_address').css('color', '#97A59E');
	$('#lightbox_compose_from_address').css('color', '#97A59E');


	// if this is not a public key, proactively try to
	// fetch the public key for this identifier to speed
	// up message sending....
        recipient = $('#lightbox_compose_to_address').val();
	recipient.trim();
        if (email_self.isPublicKey(recipient) == 0) {
	  if (email_self.app.keys.findByIdentifier(recipient) != null) {

	    // color if valid address
	    $('#lightbox_compose_to_address').css('color', '#0B6121');
	    $('#lightbox_compose_from_address').css('color', '#0B6121');

	    // highlight if can encrypt
	    recipientkeys = email_self.app.keys.findByIdentifier(recipient);
            if (email_self.app.keys.hasSharedSecret(recipientkeys.publickey) == 1) {
	      $('#lightbox_compose_to_address').css('background-color', '#f4fa58');
	      $('#lightbox_compose_from_address').css('background-color', '#f4fa58');
	      email_self.showEmailAlert("<span class='yellow-bg'>[encrypted email]</span>");

	    } else {

	      // if encryption module is installed
              for (vfd = 0; vfd < email_self.app.modules.mods.length; vfd++) {
                if (email_self.app.modules.mods[vfd].name == "Encrypt") {
	          email_self.showEmailAlert("<span id='encryptthismsg'>WARNING: plaintext email - click to encrypt</span>");
	          $('#encryptthismsg').off();
	          $('#encryptthismsg').on('click', function() {
		    email_self.showEmailAlert();
		    $('.lightbox_compose_module_select').val("Encrypt");
                    email_self.app.modules.displayEmailForm("Encrypt");
	          });
		  return;
	        }
	      }
	    }

	    return;

	  } else {

            app.dns.fetchRecordFromAppropriateServer(recipient, function(answer) {
              if (app.dns.isRecordValid(answer) == 0) {
	        $('#lightbox_compose_to_address').css('color', '#8A0808');
	        email_self.showEmailAlert("WARNING: cannot find publickey for "+recipient);
	        return;
	      }

	      dns_response = JSON.parse(answer);

              email_self.app.keys.addKey(dns_response.publickey, dns_response.identifier, 0, "Email");
              email_self.app.keys.saveKeys();

	      // color if valid address
	      $('#lightbox_compose_to_address').css('color', '#0B6121');
	      $('#lightbox_compose_from_address').css('color', '#0B6121');

	      // if encryption module is installed
              for (vfd = 0; vfd < email_self.app.modules.mods.length; vfd++) {
                if (email_self.app.modules.mods[vfd].name == "Encrypt") {
	          email_self.showEmailAlert("<span id='encryptthismsg'>WARNING: email is plaintext - click here for encryption</span>");
	          $('#encryptthismsg').off();
	          $('#encryptthismsg').on('click', function() {
		    email_self.showEmailAlert();
		    $('.lightbox_compose_module_select').val("Encrypt");
                    email_self.app.modules.displayEmailForm("Encrypt");
	          });
		  return;
	        }
	      }

            });
	  }
        } else {

	  // approve address
	  $('#lightbox_compose_to_address').css('color', '#0B6121');
	  $('#lightbox_compose_from_address').css('color', '#0B6121');

	  // highlight if can encrypt
          if (email_self.app.keys.hasSharedSecret(recipient) == 1) {
	      $('#lightbox_compose_to_address').css('background-color', '#f4fa58');
	      $('#lightbox_compose_from_address').css('background-color', '#f4fa58');
	      email_self.showEmailAlert("<span class='yellow-bg'>[encrypted email]</span>");
	  } else {

            // if encryption module is installed
            for (vfd = 0; vfd < email_self.app.modules.mods.length; vfd++) {
              if (email_self.app.modules.mods[vfd].name == "Encrypt") {
	        email_self.showEmailAlert("<span id='encryptthismsg'>WARNING: email is plaintext - click here for encryption</span>");
                $('#encryptthismsg').off();
                $('#encryptthismsg').on('click', function() {
	          email_self.showEmailAlert();
	          $('.lightbox_compose_module_select').val("Encrypt");
                  email_self.app.modules.displayEmailForm("Encrypt");
                });
                return;
              }
            }

	  }
	}
      });


      $('#lightbox_compose_module_select').off();
      $('#lightbox_compose_module_select').on('change', function() {
	email_self.showEmailAlert();
        modsel = $('#lightbox_compose_module_select').val();
        app.modules.displayEmailForm(modsel);
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


        $('#lightbox_compose_to_address').css('color', '#000');
        $('#lightbox_compose_to_address').css('background-color', '#FFF');
        $('#lightbox_compose_from_address').css('color', '#000');
        $('#lightbox_compose_from_address').css('background-color', '#FFF');
	email_self.showEmailAlert();


	$('.lightbox_compose_module_select').val("Email");
	$('.lightbox_compose_payment').val(0.0);
	$('.lightbox_compose_fee').val(2);
	email_self.resetEmailForm();
        app.modules.displayEmailForm("Email");

        $.fancybox({
          href            : '#lightbox_compose',
          fitToView       : false,
          width           : '1000px',
          height          : '650px',
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

	    // check key validity on load
            to        = $('#lightbox_compose_to_address').val();
            from      = $('#lightbox_compose_from_address').val();

            if (email_self.isPublicKey(to) == 0) {
              if (email_self.app.keys.findByIdentifier(to) != null) {

                // color if valid address
                $('#lightbox_compose_to_address').css('color', '#0B6121');
                $('#lightbox_compose_from_address').css('color', '#0B6121');

                // highlight if can encrypt
                recipientkeys = email_self.app.keys.findByIdentifier(to);
                if (email_self.app.keys.hasSharedSecret(recipientkeys.publickey) == 1) {
                  $('#lightbox_compose_to_address').css('background-color', '#f4fa58');
                  $('#lightbox_compose_from_address').css('background-color', '#f4fa58');
	          email_self.showEmailAlert("<span class='yellow-bg'>[encrypted email]</span>");
	        }
              }
	    } else {

              // color if valid address
              $('#lightbox_compose_to_address').css('color', '#0B6121');
              $('#lightbox_compose_from_address').css('color', '#0B6121');

	      // highlight if can encrypt
              if (email_self.app.keys.hasSharedSecret(to) == 1) {
	        $('#lightbox_compose_to_address').css('background-color', '#f4fa58');
	        $('#lightbox_compose_from_address').css('background-color', '#f4fa58');
	        email_self.showEmailAlert("<span class='yellow-bg'>[encrypted email]</span>");
	      }
	    }



           $('#send').off();
           $('#send').on('click', function() {

	     if (email_self.app.network.isConnected() == 0) {
	       alert("Browser lost connection to network: email not sent...");
	       return;
	     };


             to        = $('#lightbox_compose_to_address').val();
             from      = $('#lightbox_compose_from_address').val();
             amount    = $('#lightbox_compose_payment').val();
             fee       = $('#lightbox_compose_fee').val();

	     total_saito_needed = parseFloat(amount)+parseFloat(fee);

	     if (total_saito_needed > 0.0) {
	       if (app.wallet.returnBalance() < total_saito_needed) {
		 alert("Your wallet does not have enough funds: "+ total_saito_needed + " SAITO needed");
		 return;
	       }
	     }

	     // strip whitespace
	     to.trim(); from.trim(); amount.trim(); fee.trim();
	     // if this is not a public key


             // NON-PUBLIC KEY ADDRESSES MUST BE HANDLED BY MODULES
	     if (to.indexOf("@saito") > 0) {

		// try to fetch local copy
		pk = app.keys.returnPublicKeyByIdentifier(to);

                if (pk == "") {

		  // fetch publickey before sending
		  app.dns.fetchRecordFromAppropriateServer(to, function(answer) {
                    if (app.dns.isRecordValid(answer) == 0) {
		      email_self.showBrowserAlert(dns_response.err);
		      return;
		    }

		    dns_respose = JSON.parse(answer);

		    myidentifier = dns_response.identifier;
		    mypublickey  = dns_response.publickey;

		    // add to our list of keys, email ones don't need watching
		    email_self.app.keys.addKey(mypublickey, to, 0, "Email");

		    // send email using local publickey
                    newtx = app.wallet.createUnsignedTransaction(mypublickey, amount, fee);
    		    if (newtx == null) { return; }
                    modsel = $('#lightbox_compose_module_select').val();
                    newtx = app.modules.formatEmailTransaction(newtx, modsel);
                    newtx = app.wallet.signTransaction(newtx);
		    email_self.showEmailAlert("<span id='sendingthismsg'>attempting to broadcast transaction....</span>");
                    app.network.propagateTransactionWithCallback(newtx, function() {
                      email_self.showBrowserAlert("your message has been broadcast to the network");
                      $.fancybox.close();
		    });

		  });


                } else {

		  // send email using local publickey
		  to = pk;
                  newtx = app.wallet.createUnsignedTransaction(to, amount, fee);
    		  if (newtx == null) { return; }
                  modsel = $('#lightbox_compose_module_select').val();
                  newtx = app.modules.formatEmailTransaction(newtx, modsel);
                  newtx = app.wallet.signTransaction(newtx);
		  email_self.showEmailAlert("<span id='sendingthismsg'>attempting to broadcast transaction....</span>");
                  app.network.propagateTransactionWithCallback(newtx, function() {
                    email_self.showBrowserAlert("your message has been broadcast to the network");
                    $.fancybox.close();
		  });

		}

	     } else {

	       // send email using provided publickey
               newtx = app.wallet.createUnsignedTransaction(to, amount, fee);
    	       if (newtx == null) { return; }
               modsel = $('#lightbox_compose_module_select').val();
console.log("Formatting Transaction1");
               newtx = app.modules.formatEmailTransaction(newtx, modsel);
console.log("Formatting Transaction2");
               newtx = app.wallet.signTransaction(newtx);
console.log("Formatting Transaction3");
	       email_self.showEmailAlert("<span id='sendingthismsg'>attempting to broadcast transaction....</span>");
               app.network.propagateTransactionWithCallback(newtx, function() {
console.log("Formatting Transaction4");
                 email_self.showBrowserAlert("your message has been broadcast to the network");
                 $.fancybox.close();
	       });

             }
           });
          },
        });
      });



      $('.inner_message').off();
      $('.inner_message').on('click', function() {

        // update message box
        message_id    = $(this).attr('id');
        message_class = $(this).attr('class');

        message_text_selector = "#" + message_id + " > .from";
        $('#lightbox_message_from_address').text( email_self.formatAuthor($(message_text_selector).text(), email_self.app) );
        message_text_selector = "#" + message_id + " > .to";
        $('#lightbox_message_to_address').text( email_self.formatAuthor(app.wallet.returnPublicKey(), email_self.app) );

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

	      var old_email_title = $('#lightbox_message > .lightbox_message_text > .message_title').text();
	      old_email_title = 'Re: ['+old_email_title+']';

	      email_self.resetEmailForm();

              // close fancybox
              $.fancybox.close();
              // update compose message box
              $('#lightbox_compose_from_address').val( $('#lightbox_message_to_address').text() );
              $('#lightbox_compose_to_address').val( $('#lightbox_message_from_address').text() );
              $('#lightbox_compose_textarea').val("");
              $('#compose').click();

	      // set email title
	      $('#email_title').val(old_email_title);

           });
          },
        });
      });



      // unbind the checkboxs
      $('.checkbox').off('click');

}




Email.prototype.attachEmailEvents = function attachEmailEvents() {

  var email_self = this;
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
	if (email_self.app.dns.isRecordValid(answer) == 0) {
	  alert(answer);
	  return;
        }

	dns_response = JSON.parse(answer);
	if (dns_response.identifier != "") {
	  if (dns_response.publickey != "") {
	    email_self.app.keys.addKey(dns_response.publickey, dns_response.identifier, 0, "Email");
	    email_self.app.keys.saveKeys();
	  }
          email_self.app.wallet.updateIdentifier(dns_response.identifier);
          email_self.app.wallet.saveWallet();
	}

      });
    });
  }

}




Email.prototype.initializeHTML = function initializeHTML(app) {

    var email_self = this;

    // insert templates
    app.browser.insertTemplateHTML("saito-desktop-settings");



    // update wallet balance
    this.updateBalance(app);

    // customize module display
    selobj = $('#lightbox_compose_module_select');
    selobj.empty();
    for (c = 0; c < app.modules.mods.length; c++) {
      if (app.modules.mods[c].handlesEmail == 1) {
        if ( this.browser_active == 1 && app.modules.mods[c].name != "EmailMobile") {
          selmod = '<option value="'+app.modules.mods[c].name+'">'+app.modules.mods[c].emailAppName+'</option>';
          selobj.append(selmod);
        }
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



    // fetch data from app
    var tmptx                         = {};
        tmptx.transaction             = {};
        tmptx.transaction.id          = 0;
        tmptx.transaction.ts          = new Date().getTime();
        tmptx.transaction.from        = [];
        tmptx.transaction.from[0]     = {};
        tmptx.transaction.from[0].add = "david@saito";
        tmptx.transaction.msg         = {};
        tmptx.transaction.msg.module  = "Email";
        tmptx.transaction.msg.title   = "Welcome to the Saito Network (click here)";
        tmptx.transaction.msg.markdown = 0;
        tmptx.transaction.msg.data    = 'Saito Mail is a decentralized email system: \
 \
<p></p> \
 \
1. Visit our <a style="text-decoration:underline;color:#444;text-decoration:underline;" href="/faucet?mobile=no&saito_address='+app.wallet.returnPublicKey()+'">token faucet</a>. \
 \
<p></p> \
 \
2. Register an <span class="register_email_address" id="register_email_address" style="text-decoration:underline;cursor:pointer">email address</span>. \
 \
<p></p> \
 \
3. Feedback is welcome at &lt;<i>david@saito</i>&gt;. \
';
    tmptx.decrypted_msg = tmptx.transaction.msg;
    email_self.addMessageToInbox(tmptx, app);


    // load archived messages
    app.archives.processMessages(20, function (err, txarray) {
      for (var bv = 0; bv < txarray.length; bv++) {
try {
	if (txarray[bv].transaction.msg.module == "Email" || txarray[bv].transaction.msg.module == "Encrypt") {
          email_self.addMessageToInbox(txarray[bv], app);
	}
} catch (err) {
  console.log("ERRR: ");
  console.log(txarray);
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
  $('#mail_controls_message').fadeOut(3000, function() {});
}
Email.prototype.showEmailAlert = function showEmailAlert(message="") {
  $('#email_alert_box').html(message);
  $('#email_alert_box').show();
}

Email.prototype.attachMessage = function attachMessage(message, app) {

      // exit if not a browser
      if (app.BROWSER == 0) { return; }

      // sanity check on markdown - let messages decide
      var use_markdown = 1;
      if (msg.markdown != undefined) { use_markdown = msg.markdown; }

      // exit if message already exists (i.e. on page reload)
      tmp_message_id = "#message_"+message.id;
      if ($(tmp_message_id).length > 0) { return; }

      var md = markdown.toHTML(message.data);
      if (use_markdown == 0) { md = message.data; }
      var newrow = '    <tr class="outer_message" id="message_'+message.id+'"> \
                          <td class="checkbox"><input type="checkbox" class="check" name="" id="message_'+message.id+'_checkbox" /></td> \
                          <td> \
                            <table style="border:0px"> \
                              <tr class="inner_message" id="message_'+message.id+'"> \
                               <td id="message_'+message.id+'_from" class="from">'+this.formatAuthor(message.from, app)+'</td> \
                                <td id="message_'+message.id+'_title" class="title">'+message.title+'</td> \
                                <td id="message_'+message.id+'_time" class="time">'+this.formatDate(message.time)+'</td> \
                                <td id="message_'+message.id+'_module" class="module" style="display:none">'+message.module+'</td> \
                                <td id="message_'+message.id+'_data" class="data" style="display:none">'+md+'</td> \
                                <td id="message_'+message.id+'_attachment" class="attachment" style="display:none">'+message.attachment+'</td> \
                                <td id="message_'+message.id+'_attachment_name" class="attachment" style="display:none">'+message.attachment_name+'</td> \
                              </tr> \
                            </table> \
                          </td> \
                        </tr>';
      $('.message_table').prepend(newrow);

     this.attachEvents(app);

}















Email.prototype.formatDate = function formateDate(unixtime) {

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

Email.prototype.formatAuthor = function formatAuthor(author, app) {

console.log("formatting author: "+author);

  x = this.app.keys.findByPublicKey(author);
  if (x != null) { if (x.identifiers.length > 0) { return x.identifiers[0]; } }

  if (x == this.app.wallet.returnPublicKey()) {
    if (this.app.wallet.returnIdentifier() == "") { return "me"; }
  }

  var email_self = this;

  if (this.isPublicKey(author) == 1) {
    app.dns.fetchIdFromAppropriateServer(author, function(answer) {

      if (app.dns.isRecordValid(answer) == 0) {
	return author;
      }

      dns_response = JSON.parse(answer);

      // add to keylist
      email_self.app.keys.addKey(dns_response.publickey, dns_response.identifier, 0, "Email");
      email_self.app.keys.saveKeys();

      $('.from').each(function() {
        pkey = $(this).text();
        if (pkey == dns_response.publickey) { $(this).text(dns_response.identifier); }
      });

    });
  }

  return author;

}



Email.prototype.isPublicKey = function isPublicKey(publickey) {
  if (publickey.length == 44 || publickey.length == 45) {
    if (publickey.indexOf("@") > 0) {} else {
      return 1;
    }
  }
  return 0;
}
