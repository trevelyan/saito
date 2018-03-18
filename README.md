

* COMPILING VERSUS REFRESHING *

We include two files in the /lib directory that are useful for development. 
The difference is that "compile" will wipe-out the database and reset your 
server "options" file (i.e. resetting the wallet). The "refresh" script 
simply updates the javascript file that is produced for browsers without 
deleting any information on the server.

./compile  (to purge all blockchain data)
./refresh  (to preserve blockchain data)



* CONFIGURATION OPTIONS *

The configuration settings for your server will be saved in the options 
file in the /lib directory. This file will also be used as your wallet
storing transaction inputs and outputs. 

If you are setting up a new server, the simplest options file is:

{
"server":{"host":"localhost","port":12101,"publickey":""}
}

This will run a server on your machine on port 12101. For more 
complex options, you can edit the options.conf file to update
the defaults.



* RUNNING SAITO *

Please see the INSTALL file for instructions on getting Saito running. 
Once the program is executing, you can connect to Saito through your 
browser:

http://localhost:12101

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





