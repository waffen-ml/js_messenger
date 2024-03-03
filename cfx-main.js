class CfxMain {
    constructor() {
        this.core = {}
    }

    loadModule = function(file) {
        if (!/.*\.js/.test(file)) {
            console.log('Module ' + file + ' has been skipped');
            return null;
        }

        let moduleName = file.substring(0, file.length - 3);
        let module = require('./server_modules/' + moduleName);
        let cb = module.init(this);

        if (!cb) {
            //console.log('Module ' + file + ' has been loaded successfully.');
            return true;
        }

        return false;        
    }

    init = function(core) {
        this.core = core;

        try {
            let files = core.fs.readdirSync('server_modules');
            let k = 0;

            while (k != files.length) {
                k = files.length;

                for(let i = files.length - 1; i >= 0; i--)
                    if (this.loadModule(files[i]) !== false)
                        files.splice(i, 1)
            }

            files.forEach(file => {
                console.log('Unable to load ' + file);
            });
        
        } catch(err) {
            console.log('Loading of the modules failed.');
            throw err;
        }
        
        return this;
    }

}

const cfx = new CfxMain();

exports.cfx = cfx;