/////////////////////
// Web Application //
/////////////////////
//
// This function is run when the browser loads the web application. In this
// case the user just updates the page with their publickey in order to show
// it is working.
//
// If you want to load older messages to your application (i.e. email or 
// twitter client), you can fetch them from the app.archives. See our email 
// application for an example of how to handle this.
//
RemixApp.prototype.initializeHTML = function initializeHTML(app) {

    $('#saito_address').html(app.wallet.returnPublicKey());

}
//
// This callback allows us to attach events and interactivity to the 
// elements in our HTML page. Define the interactive elements of your 
// application here.
//
RemixApp.prototype.attachEvents = function attachEvents(app) {

    $('#saito_button').off();
    $('#saito_button').on('click', function() {
      alert("You clicked the button");
    });

};



