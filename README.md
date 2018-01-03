

Saito is blockchain for big-data applications.

Our goal is supporting a decentralized layer of free-speech applications
like Gmail, Twitter and Facebook on an open-access blockchain that makes
censorship effectively impossible. We achieve the scalability to do this 
by combining a transient blockchain with a security method that 
compensates nodes in the peer-to-peer network for providing bandwidth to 
the network as a whole.

 
* STEP 1: INSTALLATION *

Make sure you are running an up-to-date version fo Node (version 8.0 or
greater). Then install Saito as you would any other application:

npm install

You may need to manually install the following two modules:

npm install keythereum
npm install sqlite3


* STEP 2: ALTERNATE CONFIGURATIONS *

Note: if you make ANY changes to the source code, you should recompile
the source code to recreate the javascript file that will be given to 
lite-clients that connect to your server. You can do this by entering 
the lib/ directory and typing:

./compile  (to purge all blockchain data)
./refresh  (to preserve blockchain data)

The configuration settings for your server will be saved in the options 
file in the /lib directory. This file will also be used as your wallet
storing transaction inputs and outputs. 

If you are setting up a new server, the simplest options file is:

{
"server":{"host":"localhost","port":12100,"publickey":""}
}



* STEP 3: USING SAITO *

To run Saito just enter the lib/ directory and start the software:

node --max_old_space_size=6144 start.js

We recommend allocating 6 GB of memory for the application if you are
planning to run a production server. If you are playing around with 
the software and running a local version, there is no need for extra
memory allocation.

If you wish to run the software as a background service, do the following:

nohup node --max_old_space_size=6144 start.js > saito.log 2> saito.err &

This second command is more useful for remote servers, as it will
keep Saito running once the connection is closed. To ensure that this
happens, wait a few seconds after starting the program and type "Cntl-C"
at the command line. You will see the ^C command printed at the terminal 
but get no other indication of any changes). Then type "exit" to close 
your terminal. Saito will now continue running in the background -- note 
that if you do not hit Cntl-C and/or do not type exit the program will 
close when you close your terminal window or disconnect from the server.

You can now connect to Saito through your browser:

http://localhost:12100

If you are interested in developing the application, you can find the 
default start page for the main server in the source code directory at:

lib/saito/web/index.html

Most of the user-driven functionality is coded in optional modules that 
create web applications. Our blockchain explorer, for instance, is just 
a regular Saito application module (info). The file that controls which 
modules are loaded is:

lib/modules/mods.js

The modules themselves are contained in sub-directories within that 
directory. A good way to get familiar with Saito (and find out how it
works under the hood) is to look at these modules. Existing apps can 
act as simple tutorials on how to code your own applications.

If you have any questions or need help please get in touch:

david@satoshi
david@popupchinese.com





