# gitignore-merge

Merge multiple `.gitignore` files.

Sections defined with the same `#@ Section name` are merged.

Blocks within sections are identified by a leading comment are merged within sections.

### Example


```js
var merge = require('gitignore-merge');
merge(A, B, { sort: true });
```

**File A:**
```
#@ Platform Specific
.DS_Store

#@ Node
node_modules

#logs
*.log

# Build
build
```

**File B:**
```
#@ Platform Specific
Thumbs.db

#@ Node
# Coverage directory
coverage

#logs
.logs
```
**Result:**
```
#@ Node
node_modules

# Build
build

# Coverage directory
coverage

# logs
*.log
.logs

#@ Platform Specific
.DS_Store
Thumbs.db
```
