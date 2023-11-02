const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'data');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({storage: storage});
const fs = require('fs');
const utils = require('./utils');


class Files {
    constructor(cfx) {
        this.cfx = cfx;
    }

    createBundle() {
        return this.cfx.query('insert into bundle() values()')
        .then((result) => {
            return result.insertId;
        })
    }

    addFiles(files, bundle) {
        if(!files.length)
            return Promise.resolve();
        let tuples = [];
        bundle ??= null;
        files.forEach(f => {
            let mt = utils.simplifyMimetype(f.mimetype);
            tuples.push(`(${bundle}, "${f.filename}", "${mt}")`);
        })
        return this.cfx.query('insert into file (bundle_id, name, mimetype) values '
            + tuples.join());
    }

    addFilesInBundle(files) {
        if(!files || !files.length)
            return Promise.resolve(null);
        return this.createBundle()
        .then(b => {
            return this.addFiles(files, b)
            .then(() => b);
        });
    }

}

exports.init = (cfx) => {
    if(!cfx.db)
        return true;

    cfx.core.upload = upload;
    cfx.files = new Files(cfx);
}