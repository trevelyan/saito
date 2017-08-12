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
    app.modules.returnModule("Email").addMessageToInbox(tx, app);

    app.storage.saveMessage(tx);

  }

}




/////////////////////////////
// Display User Input Form //
/////////////////////////////
Email.prototype.displayUserInputForm = function displayUserInputForm() {

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
    msg.time   = formatDate(tx.transaction.ts);
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

      email_self = this;

      $('#lightbox_compose_module_select').off();
      $('#lightbox_compose_module_select').on('change', function() {
        modsel = $('#lightbox_compose_module_select').val();
        app.modules.displayUserInputForm(modsel);
      });



      $('#resync_button').off();
      $('#resync_button').on('click', function() {
	alert("Resyncing BLockchain from Scatch");
        app.blockchain.resetBlockchain();
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

             newtx = app.wallet.createUnsignedTransactionWithFee(to, amount, fee);
             modsel = $('#lightbox_compose_module_select').val();
             newtx = app.modules.formatTransaction(newtx, modsel);
             newtx = app.wallet.signTransaction(newtx);

	     // we don't need to add to our mempool since we don't bundle transactions
             app.network.propagateTransaction(newtx);
             email_self.showBrowserAlert("your message has been broadcast to the network");

             $.fancybox.close();
           });
          },
        });
      });


      $('#viewkeys').off();
      $('#viewkeys').on('click', function() {
        $.fancybox({
          href            : '#lightbox_viewkeys',
          fitToView       : false,
          width           : '1000px',
          height          : '600px',
          closeBtn        : true,
          autoSize        : false,
          closeClick      : true,
          openEffect      : 'none',
          closeEffect     : 'none',
          helpers: {
            overlay : {
              closeClick : true
            }
          },
          keys : {
            close : null
          },
        });
      });





      $('.inner_message').off();
      $('.inner_message').on('click', function() {

        // update message box
        message_id    = $(this).attr('id');
        message_class = $(this).attr('class');

        message_text_selector = "#" + message_id + " > .from";
        $('#lightbox_message_from_address').text( $(message_text_selector).text());

        message_text_selector = "#" + message_id + " > .to";
        $('#lightbox_message_to_address').text( app.wallet.returnPublicKey() );

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


	    // attach events to our email as needed
            email_self.app.modules.returnModule(module).attachEmailEvents(app);


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





    // load saved messages into email client
    for (ii = 0; ii < app.options.messages.length; ii++) {
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
                                <td class="from">'+message.from+'</td> \
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















formatDate = function formateDate(unixtime) {

  x = new Date(unixtime);
  return x.getDate() + " / " + (x.getMonth()+1) + " / " + x.getFullYear();

}







