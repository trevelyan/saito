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


## Contact
If you have any questions or need help please get in touch:  

* david@saito
* david@popupchinese.com  
