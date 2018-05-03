# Welcome to Saito

## Getting started
If you just downloaded Saito and want to get it running, please read our 
[INSTALL file](INSTALL.md) instead of this one. This README contains more general
information that might be useful for developers getting started.



## Compiling versus refreshing
We include two files in the /lib directory that are useful for development. 
The difference is that "compile" will wipe-out the database and reset your 
server "options" file. The "refresh" script simply updates the javascript 
file that is produced for browsers without deleting any information.

```
./compile  (to purge all blockchain data)
./refresh  (to preserve blockchain data)
```


## For developers
Please see the INSTALL file for instructions on getting Saito running. 
Once the program is executing, you can connect to Saito through your 
browser:

http://localhost:12101

You can find the default start page for this webpage in our source code
directory at the following location:
```
lib/saito/web/index.html
```

Most of the user-driven functionality is coded in optional modules that 
create web applications. Our blockchain explorer, for instance, is just 
a regular Saito application module. The file that controls which modules 
are loaded by any server is:
```
lib/modules/mods.js
```

The modules themselves are contained in sub-directories within that 
directory. A good way to get familiar with Saito (and find out how it
works under the hood) is to look at these modules. Existing apps can 
act as simple tutorials on how to code your own applications.  


### Unit tests
Unit test setup is prepared with [Jest](https://facebook.github.io/jest).  
This will run the tests and create a coverage report:
```
npm test
```

#### Coverage
After running the tests the generate report can be found here:  
`test/unit/coverage/lcov-report/index.html`


#### Run tests with watcher
During development you can run the tests in watch-mode without creating coverage each time using this command:
```
npm test -- --watch --no-coverage
```
For further info please check [the Jest docs](https://facebook.github.io/jest/docs/en/getting-started.html)

### API and Documentation
A quick guide to where the important stuff lives:

#### `/lib/*`

This is the home directory. Your `options` file goes here and contains the most important configuration information (peers, dns servers, wallet, etc). In browsers this file is basically saved in localStorage. The `compile` script in this directory will do a hard reset of all data. The `refresh` script will recompile the javascript version of the code (see [browser.js](https://github.com/trevelyan/saito/blob/master/lib/browser.js)) that gets sent out to users who connect to your server and do not already have a cached version of the javascript.  

If you have any development problems and are running a local node, do a hard reset with that “compile”. You should use the “refresh” script after you update any modules.

#### `/lib/saito/*`

This is where we put the classes which run the core features of the blockchain: monitoring the network, handling interactions with peers, managing the mempool and building blocks. If you want to get your hands dirty, you can access these objects through the “app” object that is passed along with most module callbacks.

#### `/lib/saito/web/*`

This is where the webpage you see in your browser when you visit your Saito node is located. Right now applications themselves are just tiny webpages that load the javascript file from We have a couple of default libraries that are bundled into our distribution like jquery and you can find those here as well.

#### `/lib/modules/*`

This is where you install modules. All modules go into the `mods` subdirectory in this directory. In order to install a module, put it in the mods subdirectory like all of the others then edit the file `mods.js` in this folder to tell Saito that you want to load it. Everything should be pretty clear.  

You’ll notice a template.js file in here as well. That is the parent class from which all modules inherent their functionality. You can look at it and see exactly what functions you can extend when building applications. We try to keep this file well-commented.


## Contact
If you have any questions or need help please get in touch:  

* david@saito
* david@popupchinese.com  
