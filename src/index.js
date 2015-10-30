export function tokenize(input) {
  const WHITESPACE = /^[^\n\S]+/;
  const COMMENT = /^#[^\S\n]*([^\n]*)\n?/;
  const HEADER = /^[^\S\n]*#@[^\S\n]+([^\n]*)\n?/;
  const LINE = /^(?:\n[^\n\S]*)+/;
  const RULE = /^([^#\n][^\n]*)\n?/;

  const tokens = [];
  let chunk;
  let inBlock;
  let inSection;

  function tag() {
    return (tokens.length ? tokens[tokens.length - 1] : [])[0];
  }

  function addToken(tag, value) {
    let token;
    if (value !== undefined) {
      token = [ tag, value ];
    } else {
      token = [ tag ];
    }
    tokens.push(token);
    return token;
  }

  function whitespaceToken() {
    const match = chunk.match(WHITESPACE);
    if (!match) return 0;
    return match[0].length;
  }

  function sectionToken() {
    const match = chunk.match(HEADER);
    if (!match) return 0;
    inBlock = false;
    inSection = true;
    addToken('SECTION', match[1]);
    return match[0].length;
  }

  function commentToken() {
    const match = chunk.match(COMMENT);
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
    const match = chunk.match(LINE);
    if (!match) return 0;
    addToken('LINE');
    return match[0].length;
  }

  function ruleToken() {
    const match = chunk.match(RULE);
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

  let i = 0;
  while ((chunk = input.slice(i))) {
    const consumed =
      whitespaceToken() ||
      sectionToken() ||
      commentToken() ||
      lineToken() ||
      ruleToken();

    i += consumed;
  }

  return tokens;
}

export function parse(tokens) {
  const tree = [];
  let section;
  let block;

  function addSection(token) {
    section = { title: token[1], blocks: [] };
    tree.push(section);
  }

  function addBlock(token) {
    block = { title: token[1], lines: [] };
    section.blocks.push(block);
  }

  function addLine(token) {
    block.lines.push(token);
  }

  tokens.forEach(token => {
    switch (token[0]) {
    case 'SECTION':
      addSection(token);
      break;
    case 'BLOCK':
      addBlock(token);
      break;
    case 'RULE':
    case 'COMMENT':
      addLine(token);
      break;
    default:
      break;
    }
  });

  return tree;
}

export function mergeBlock(target, source) {
  return {
    ...target,
    lines: source.lines.reduce((lines, line) => {
      const lineMatch = lines.find(item => {
        return item[0] === line[0] && item[1] === line[1];
      });
      if (!lineMatch) {
        target.lines.push(line);
      }
      return lines;
    }, target.lines),
  };
}

export function mergeSection(target, source, { mergeBlocks }) {
  return {
    ...target,
    blocks: source.blocks.reduce((blocks, block) => {
      // Identify a matching target block.
      const targetBlock = mergeBlocks ? blocks.find(item => {
        return item.title === block.title;
      }) : null;

      if (targetBlock) {
        mergeBlock(targetBlock, block);
      } else {
        blocks.push(block);
      }

      return blocks;
    }, target.blocks),
  };
}

function extractOptions(args) {
  const last = args[args.length - 1];
  if (Object.prototype.toString.call(last) === '[object Object]') {
    return [ args.slice(0, -1), last ];
  }
  return [ args ];
}

export function merge(target, ...args) {
  const [ sources, options ] = extractOptions(args);

  function _merge(target, sources, {
    mergeSections = true,
    mergeBlocks = true,
  } = {}) {
    return sources.reduce((target, source) => {
      return source.reduce((target, section) => {
        // Identify matching a target section.
        const targetSection = mergeSections ? target.find(item => {
          return item.title === section.title;
        }) : null;

        if (targetSection) {
          mergeSection(targetSection, section, { mergeBlocks });
        } else {
          target.push(section);
        }

        return target;
      }, target);
    }, target);
  }

  return _merge(target, sources, options);
}

function compile(tree, { sort = true } = {}) {
  function lower(string) {
    return string ? string.toLowerCase() : '';
  }

  function sortTitle(a, b) {
    if (lower(a.title) < lower(b.title)) return -1;
    if (lower(a.title) > lower(b.title)) return 1;
    return 0;
  }

  if (sort) {
    // sort sections
    tree.sort(sortTitle);

    // sort blocks
    tree.forEach(function(section) {
      section.blocks.sort(sortTitle);
    });
  }

  function heading(prefix, title) {
    return `#${prefix}${ title ? ` ${title} ` : '' }\n`;
  }

  function comment(text) {
    return text ? [`# ${text}`] : [];
  }

  return tree.map(function(section) {
    return `${heading('@', section.title)}${
      section.blocks.map(function(block) {
        return `${heading('', block.title)}${
          block.lines.reduce(function(reduced, line) {
            switch (line[0]) {
            case 'RULE':
              return reduced.concat([line[1]]);
            case 'COMMENT':
              return reduced.concat(comment(line[1]));
            default:
              break;
            }
          }, []).join('\n')
        }`;
      }).join('\n\n')
    }`;
  }).join('\n\n');
}

export default function(...args) {
  const [ sources, options ] = extractOptions(args);
  const parsed = sources.map(source => parse(tokenize(source)));
  const merged = merge(...parsed, options);
  return compile(merged, options);
}
