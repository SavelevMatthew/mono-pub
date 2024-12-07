const fs = require('fs')

function test1() {
    function someFunc(entry) {
        var extractPath = path.join(opts.path, entry.path);
        return extractFile(extractPath);
    }
    someFunc();
}