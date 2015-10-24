var merge = require('../src');
var fs = require('fs');
var path = require('path');

var node = fs.readFileSync(path.join(__dirname, 'node.gitignore'), 'utf8');
var osx = fs.readFileSync(path.join(__dirname, 'osx.gitignore'), 'utf8');
var windows = fs.readFileSync(path.join(__dirname, 'windows.gitignore'), 'utf8');
var sublime = fs.readFileSync(path.join(__dirname, 'sublimetext.gitignore'), 'utf8');

console.log(merge(node, osx, windows, sublime, { sort: true }));
