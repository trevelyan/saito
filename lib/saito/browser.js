var saito = require('../saito');




function Browser(app) {

  if (!(this instanceof Browser)) {
    return new Browser(app);
  }

  this.app = app || {};

}
module.exports = Browser;





Browser.prototype.initialize = function initialize() {

    browser_browser_self = this;

    if (this.app.BROWSERIFY == 0) { return; }


    // customize module display
    selobj = $('#lightbox_compose_module_select');
    selobj.empty();
    for (c = 0; c < browser_browser_self.app.modules.mods.length; c++) {
        selmod = '<option value="'+browser_browser_self.app.modules.mods[c].name+'">'+browser_browser_self.app.modules.mods[c].name+'</option>';
        selobj.append(selmod);
    };


    // default to our mail client
    browser_browser_self.app.modules.displayUserInputForm("Email");


    // update the default FROM address to our own, to address blank
    $('#lightbox_compose_from_address').val(browser_browser_self.app.wallet.returnPublicKey());
    $('#lightbox_compose_to_address').val("");

    this.attachEvents();

    // tell the browser what our public/private keys look like
    $('#lightbox_viewkeys_publickey').html(this.app.wallet.returnPublicKey());
    $('#lightbox_viewkeys_privatekey').html(this.app.wallet.returnPrivateKey());

/****
    // load any existing messages into our client template
    console.log("I WANT TO LOAD MESSAGES INTO OUR BROWSER");
    console.log(this.app.options["Messages"][0]);

    for (i = 0; i < this.app.options["Messages"].length; i++) {
      tx = JSON.parse(this.app.options["Messages"][i]);
      if (tx.message.module != "") {
        txmod = tx.message.module;
        browser_browser_self.app.modules.attachMessageToBrowser(tx, txmod, browser_browser_self);
      }
    }
****/

}





Browser.prototype.attachEvents = function attachEvents() {

      browser_self = this;

      $('#lightbox_compose_module_select').off();
      $('#lightbox_compose_module_select').on('change', function() {
        modsel = $('#lightbox_compose_module_select').val();
        browser_self.app.modules.updateBrowser(modsel);
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
             newtx = browser_self.app.modules.formatMessage(newtx, modsel);
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
        });
      });


      $('.message').off();
      $('.message').on('click', function() {

        // update message box
        message_id = $(this).attr('id');

        message_text_selector = "#" + message_id + " > .from";
        $('#lightbox_message_from_address').text( $(message_text_selector).text());

        message_text_selector = "#" + message_id + " > .to";
        $('#lightbox_message_from_address').text( browser_self.app.wallet.returnPublicKey() );

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


}











Browser.prototype.attachMessage = function attachMessage(message) {

      var newrow = '    <tr class="message" id="message_'+message.id+'"> \
                          <td class="checkbox"><input type="checkbox" class="check" name="" id="message_'+message.id+'_checkbox" /></td> \
                          <td class="from">'+message.from+'</td> \
                          <td class="title">'+message.title+'</td> \
                          <td class="time">'+message.time+'</td> \
                          <td class="module" style="display:none">'+message.module+'</td> \
                          <td class="json" style="display:none">'+message.json+'</td> \
                        </tr>';
      $('.message_table').prepend(newrow);

      this.attachEvents();

}





