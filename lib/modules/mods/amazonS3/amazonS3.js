var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');



var S3_KEY = "";
var S3_SEC = "";

var s3 = require('s3');
var client = s3.createClient({
  maxAsyncS3: 20,     // this is the default 
  s3RetryCount: 3,    // this is the default 
  s3RetryDelay: 1000, // this is the default 
  multipartUploadThreshold: 20971520, // this is the default (20 MB) 
  multipartUploadSize: 15728640, // this is the default (15 MB) 
  s3Options: {
    accessKeyId: S3_KEY,
    secretAccessKey: S3_SEC,
    // any other options are passed to new AWS.S3() 
    // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html#constructor-property 
  },
});


//////////////////
// CONSTRUCTOR  //
//////////////////
function AmazonS3(app) {

  if (!(this instanceof AmazonS3)) { return new AmazonS3(app); }

  AmazonS3.super_.call(this);

  this.app              = app;

  this.name             = "AmazonS3";
  this.browser_active   = 0;
  this.handlesArchiving = 0;

  return this;

}
module.exports = AmazonS3;
util.inherits(AmazonS3, ModTemplate);









AmazonS3.prototype.saveMessage = function saveMessage() {

  var params = {

    localFile: "some/local/file",
 
    s3Params: {
      Bucket: "s3 bucket name",
      Key: "some/remote/file",
      // other options supported by putObject, except Body and ContentLength. 
      // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property 
    },
  };

  var uploader = client.uploadFile(params);
  uploader.on('error', function(err) { console.error("unable to upload:", err.stack); });
  uploader.on('progress', function() { console.log("progress", uploader.progressMd5Amount, uploader.progressAmount, uploader.progressTotal); });
  uploader.on('end', function() { console.log("done uploading"); });

}
AmazonS3.prototype.loadMessage = function loadMessage() {

  var params = {

    localFile: "some/local/file",
 
    s3Params: {
      Bucket: "s3 bucket name",
      Key: "some/remote/file",
      // other options supported by putObject, except Body and ContentLength. 
      // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property 
    },
  };

  var downloader = client.downloadFile(params);
  downloader.on('error', function(err) { console.error("unable to download:", err.stack); });
  downloader.on('progress', function() { console.log("progress", downloader.progressAmount, downloader.progressTotal); });
  downloader.on('end', function() { console.log("done downloading"); });

}





/////////////////////////
// Handle Web Requests //
/////////////////////////
//
// This is a bit more complicated than it needs to be, because
// we want to be able to send users to the main Saito amazons3 if
// the application is not called with a Saito address.
//
// This design allows us to have links WITHIN our javascript bundle
// that point to off-server amazons3s but return people to the local
// URL (i.e. their URL-specific wallet).
// 
// This is designed for countries like China and other networks where
// firewalls can degrade large javascript downloads but otherwise 
// do not prevent connectivity.
AmazonS3.prototype.webServer = function webServer(app, expressapp) {
  var amazons3_self = this;
  expressapp.get('/amazons3/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
}





