var saito = require('../saito');




function Browser(app) {

  if (!(this instanceof Browser)) {
    return new Browser(app);
  }

  this.app = app || {};
  this.monitor_timer   = null;
  this.monitor_speed   = 5000;  // every second
}
module.exports = Browser;





Browser.prototype.initialize = function initialize() {

    browser_self = this;

    if (this.app.BROWSERIFY == 0) { return; }
 
    if (this.app.options.messages == null) { this.app.options.messages = []; }


    // update wallet balance
    this.updateBalance();


    // customize module display
    selobj = $('#lightbox_compose_module_select');
    selobj.empty();
    for (c = 0; c < browser_self.app.modules.mods.length; c++) {
        selmod = '<option value="'+browser_self.app.modules.mods[c].name+'">'+browser_self.app.modules.mods[c].name+'</option>';
        selobj.append(selmod);
    };


    // default to our mail client
    browser_self.app.modules.displayUserInputForm("Email");


    // update the default FROM address to our own, to address blank
    $('#lightbox_compose_from_address').val(browser_self.app.wallet.returnPublicKey());
    $('#lightbox_compose_to_address').val("");

    this.attachEvents();

    // tell the browser what our public/private keys look like
    $('#lightbox_viewkeys_publickey').html(this.app.wallet.returnPublicKey());
    $('#lightbox_viewkeys_privatekey').html(this.app.wallet.returnPrivateKey());



    // load saved messages into email client
    for (ii = 0; ii < this.app.options.messages.length; ii++) {
      tx = new saito.transaction(this.app.options.messages[ii]);
      if (tx.transaction.msg.module != "") {
        txmod = tx.transaction.msg.module;
        browser_self.app.modules.addMessageToInbox(tx, txmod);
      }
    }

}





Browser.prototype.attachEvents = function attachEvents() {

      browser_self = this;

      $('#lightbox_compose_module_select').off();
      $('#lightbox_compose_module_select').on('change', function() {
        modsel = $('#lightbox_compose_module_select').val();
        browser_self.app.modules.updateBrowser(modsel);
      });




      $('#mail_controls_delete').off('click');
      $('#mail_controls_delete').on('click', function() {

        $('.check:checked').each(function() {

	  id = $(this).attr('id');
          trclass = id.substring(0, id.length-9);
	  msg_id  = trclass.substring(8);
          domobj = "#"+trclass; 
	  browser_self.app.storage.removeMessage(msg_id);
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
             amount    = 0.0;

             newtx = browser_self.app.wallet.createUnsignedTransaction(to, amount);
             modsel = $('#lightbox_compose_module_select').val();
             newtx = browser_self.app.modules.formatTransaction(newtx, modsel);
             newtx = browser_self.app.wallet.signTransaction(newtx);

             browser_self.app.network.propagateTransaction(newtx);

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
        $('#lightbox_message_to_address').text( browser_self.app.wallet.returnPublicKey() );

        message_text_selector = "#" + message_id + " > .module";
        console.log(message_text_selector);
        module = $(message_text_selector).text();
        console.log(module);


        browser_self.app.modules.displayMessage(message_id, module);


        $('#compose').click();

        $.fancybox({
          href            : '#lightbox_message',
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
          afterShow : function(){
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











Browser.prototype.attachMessage = function attachMessage(message) {

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

      this.attachEvents();

}



Browser.prototype.monitorBlockchainSyncing = function monitorBlockchainSyncing(remote_blkid, remote_genesis_blkid) {

  $( "#connections_sync" ).progressbar({ value: 100 });

  var local_block_id  = this.app.options.lastblock;

  if (local_block_id == remote_blkid) {
    return;
  }


  // the remote machine cannot sync from our 
  // current starting point because it has 
  // already adjusted its genesis block forward
  // so we treat its genesis block as our own
  // genesis block starting point.
  if (remote_genesis_blkid > local_block_id) {
    local_block_id = remote_genesis_blkid; 
  }

  var remote_block_id = remote_blkid;
  browser_self = this;

  this.monitor_timer = setInterval(function(){
    found = 1;
    while (found == 1 && local_block_id <= remote_block_id) {
      if (browser_self.app.blockchain.isBlockIdIndexed(local_block_id) == 1) { local_block_id++; }
      else {
        local_block_id--;
        found = 0;
      }
    }
    
    var percent_downloaded = 0;
    if (remote_block_id > 0) {
      percent_downloaded = Math.floor(( local_block_id / remote_block_id ) * 100);
    }

    $( "#connections_sync" ).progressbar({
      value: percent_downloaded
    });

    if (percent_downloaded == 100) {
      // ensure we update our options file
      browser_self.app.storage.saveOptions();
      clearInterval(browser_self.monitor_timer);
    }
  }, this.monitor_speed);

}



Browser.prototype.updateBalance = function updateBalance() {

    if (this.app.BROWSERIFY == 0) { return; } 

    // update wallet balance
    $('#balance').html(this.app.wallet.returnBalance());

}



