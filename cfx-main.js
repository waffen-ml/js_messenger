class CfxMain {
    
    as = function(session) {
        const shallow = Object.assign({}, this);
        shallow.session = session;
        return shallow;
    }

    method() {
        
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

}

const cfx = new CfxMain();

require('./cfx-forms').init(cfx);
require('./cfx-auth').init(cfx);
require('./cfx-chat').init(cfx);
cfx.utils = require('./cfx-utils');

module.exports = { cfx };