class CfxMain {
    
    as = function(session) {
        const shallow = Object.assign({}, this);
        shallow.session = session;
        return shallow;
    }

    empty = function() {
        return this.session === undefined;
    }

    sdata = function(f) {
        if (this.empty())
            return undefined;
        if (typeof f === "string") {
            let obj = this.session;
            f.split('.').forEach((p) => {
                obj = obj[p];
            });
            return obj;
        }
        return f(this.session);
    }
    
    user = function() {
        return this.auth.getUser(this.sdata('userid'));
    }

    takeid = function(id) {
        if (this.empty()) return;
        this.auth.authSession(id, this.session);
        console.log(this.session);
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
            console.log('Module ' + file + ' has been loaded successfully.');
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