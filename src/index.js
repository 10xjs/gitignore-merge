function tokenize(input) {
  var WHITESPACE = /^[^\n\S]+/;
  var COMMENT = /^#[^\S\n]*([^\n]*)\n?/;
  var HEADER = /^[^\S\n]*#@[^\S\n]+([^\n]*)\n?/;
  var LINE = /^(?:\n[^\n\S]*)+/;
  var RULE = /^([^#\n][^\n]*)\n?/;

  var tokens = [];
  var chunk;
  var inBlock;
  var inSection;
  var comsumed;
  var i = 0;

  function tag() {
    return (tokens.length ? tokens[tokens.length -1] : [])[0];
  }

  function addToken(tag, value) {
    var token;
    if (value !== undefined) {
      token = [ tag, value ];
    } else {
      token = [ tag ];
    }
    tokens.push(token);
    return token;
  }

  function whitespaceToken() {
    var match = chunk.match(WHITESPACE);
    if (!match) return 0;
    return match[0].length;
  }

  function sectionToken() {
    var match = chunk.match(HEADER);
    if (!match) return 0;
    inBlock = false;
    inSection = true;
    addToken('SECTION', match[1]);
    return match[0].length;
  }

  function commentToken() {
    var match = chunk.match(COMMENT);
    if (!match) return 0;
    if (! inSection) {
      addToken('SECTION');
    }
    if (tag() !== 'BLOCK' && tag() !== 'COMMENT') {
      addToken('BLOCK', match[1]);
      inBlock = true;
    } else {
      addToken('COMMENT', match[1]);
    }
    return match[0].length;
  }

  function lineToken() {
    var match = chunk.match(LINE);
    if (!match) return 0;
    addToken('LINE');
    return match[0].length;
  }

  function ruleToken() {
    var match = chunk.match(RULE);
    if (!match) return 0;
    if (! inSection) {
      addToken('SECTION');
    }
    if (!inBlock) {
      addToken('BLOCK');
      inBlock = true;
    }
    addToken('RULE', match[1]);
    return match[0].length;
  }

  while (chunk = input.slice(i)) {
    consumed =
      whitespaceToken() ||
      sectionToken() ||
      commentToken() ||
      lineToken() ||
      ruleToken();

    i += consumed;
  }

  return tokens;
}

function parse(tokens) {
  var token;
  var section;
  var block;
  var block;
  var tree = [];

  function addSection() {
    section = { title: token[1], blocks: [] };
    tree.push(section);
  }

  function addBlock() {
    block = [token];
    section.blocks.push(block);
  }

  function addLine() {
    block.push(token);
  }
  while (token = tokens.shift()) {
    switch (token[0]) {
    case 'SECTION':
      addSection();
      break;
    case 'BLOCK':
      addBlock();
      break;
    case 'RULE':
    case 'COMMENT':
      addLine();
      break;
    default:
      break;
    }
  }

  return tree;
}
function merge(target, source, options) {

  function find(array, callback) {
    var i = 0;
    var item;

    while ( item = array[i]) {
      if (callback(item)) return item;
      i++;
    }
  }

  source.forEach(function(section) {
    var sectionMatch = find(target, function(item) {
      return item.title === section.title;
    });
    if (sectionMatch) {
      section.blocks.forEach(function(block) {
        var blockMatch = find(sectionMatch.blocks, function(item) {
          return block[0][1] === item[0][1];
        });
        if (blockMatch) {
          if (options.merge) {
            var lines = blockMatch.slice(1);
            block.slice(1).forEach(function(line) {
              var lineMatch = lines.find(function(item) {
                return item[0] === line[0] && item[1] === line[1];
              });
              if (!lineMatch) {
                blockMatch.push(line);
              }
            });
          } else {
            blockMatch.blocks = block.blocks;
          }
        } else {
          sectionMatch.blocks.push(block);
        }
      })
    } else {
      target.push(section);
    }
  });
  return target;
}

function compile(tree, options) {

  function lower(string) {
    return string ? string.toLowerCase() : '';
  }

  if (options.sort) {
    // sort sections
    tree.sort(function(a, b) {
      if (lower(a.title) < lower(b.title)) return -1;
      if (lower(a.title) > lower(b.title)) return 1;
      return 0;
    });

    // sort section blocks
    tree.forEach(function(section) {
      section.blocks.sort(function(a, b) {
        if (lower(a[0][1]) < lower(b[0][1])) return -1;
        if (lower(a[0][1]) > lower(b[0][1])) return 1;
        return 0;
      });
    }); 
  }

  return tree.map(function(section) {
    return '#@ ' + (section.title || '') + '\n' +
      section.blocks.map(function(block) {
        return block.reduce(function(reduced, line) {
            switch (line[0]) {
            case 'RULE':
              return reduced.concat([line[1]]);
            case 'BLOCK':
            case 'COMMENT':
              return reduced.concat(line[1] ? ['# ' + line[1]] : []);
            }
          }, []).join('\n')
      }).join('\n\n');
  }).join('\n\n');
}

module.exports = function() {
  var sources = arguments;
  var options = {};
  if (Object.prototype.toString.call(arguments[arguments.length -1]) === '[object Object]') {
    sources = [].slice.call(arguments, 0, -1);
    options = [].slice.call(arguments, -1);
  }

  var merged = [].reduce.call(sources, function(reduced, source) {
    return merge(reduced, parse(tokenize(source)), options);
  }, []);

  return compile(merged, options);
}
