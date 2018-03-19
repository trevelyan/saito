/////////////////////
// Email Callbacks //
/////////////////////
//
// This callback controls how your Application shows up in the email client. 
// Use HTML to display information or create a form.
//
RemixApp.prototype.displayEmailForm = function displayEmailForm(app) {

  $('#module_editable_space').html('<div id="module_instructions" class="module_instructions">Edit the controls in standard HTML? </div>');

}
//
// This callback is run when the user clicks "send". Grab the data from your form
// (or javascript code) and stick it into your transaction.
//
RemixApp.prototype.formatEmailTransaction = function formatEmailTransaction(tx, app) {

  tx.transaction.msg.module = this.name;
  tx.transaction.msg.remix_data = "Add whatever data you want to your transaction.";
  return tx;

}



