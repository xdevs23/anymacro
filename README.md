# AnyMacro Preprocessor

This is a simple C-style preprocessor that you can use on any type of files.
You can use it on plain text files, Java, C, C++, Python, and pretty much anything else.
It's currently written in JavaScript and it should be compiled using [pkg](https://github.com/zeit/pkg).

If you wish to use node directly, feel free to do so as well.

## Binaries

View the [releases](https://github.com/xdevs23/anymacro/releases).
From version 1.1.0 on, there are binaries for Linux, macOS and Windows.
Note that only the Linux binary has been tested by me, so if the other ones
do not work please [create a new issue](https://github.com/xdevs23/anymacro/issues/new)
and explain what exactly is wrong and the platform you tried to use the binary
on, and of course, which binary you used.

## pkg

```
sudo npm install -g pkg
pkg -t node8-linux-x86 js/index.js
./index
```

You should use node 8 for this, however, you can also try older versions.
For more detailed information, read the [Usage section of pkg's README](https://github.com/zeit/pkg#usage).
You can also find all available options simply by executing `pkg` without parameters.

## node

Using node is fairly simple:

```
node js/index.js
```
