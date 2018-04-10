# node-mv

This is a utility command line tool for renaming or moving node.js file/folder. It will update all the files
under the current folder to have correct references to the moved files.

Note: Both js and coffee files are supported.

## How to get it?

```bash
npm install node-mv -g
```

## How to run it?

### Exclude dir/files

### Git support

If you source file is under git repo, use `--git` option


```bash
node-mv sample.js sample-renamed.js --git
```

You can pass a list of regex to `--excludes` to exclude folders or files you don't want the program to search

```bash
node-mv sample.js sample-renamed.js --excludes=build,coverage
```


### Run it without any options

```bash
node-mv sample.js sample-renamed.js 
```

## License
The MIT License (MIT)

Copyright (c) 2014 viruschidai@gmail.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
