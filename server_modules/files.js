const multer = require('multer')
const path = require('path')
const utils = require('./utils')
const storage = multer.memoryStorage();
const upload = multer({storage: storage});
const fs = require('fs');
const { Readable } = require('stream')

class Files {
    constructor(cfx) {
        this.cfx = cfx;
    }

    getFile(id) {
        return this.cfx.query('select * from file where id=?', [id])
        .then(r => {
            return r.length? r[0] : null
        })
    }

    createBundle(chat_id, post_id) {
        return this.cfx.query(`insert into bundle(chat_id, post_id)
        values(?, ?)`, [chat_id, post_id])
        .then(v => v.insertId)
    }

    setBundleInfo(bundle_id, chat_id, post_id) {
        return this.cfx.query(`update bundle set chat_id=?, post_id=? where id=?`, 
            [chat_id, post_id, bundle_id])
    }

    saveFiles(files, bundle) {
        if(!files || !files.length)
            return Promise.resolve({bundle: null, ids: []})

        return Promise.all(files.map(f => {
            let name = Buffer.from(f.originalname, 'latin1').toString('utf8')

            return this.cfx.query(`insert into file(name, mimetype, 
                bundle_id, data) values(?,?,?,binary(?))`,
                [name, utils.simplifyMimetype(f.mimetype), bundle ?? null, f.buffer])
        }))
        .then(values => {
            return values.map(v => v.insertId)
        })
    }
}

exports.init = (cfx) => {
    if(!cfx.db)
        return true;

    cfx.core.safeGet('/file', (_, req, res) => {
        return cfx.files.getFile(req.query.id)
        .then(file => {
            if (!file)
                throw Error('Unknown file')

            let buffer = Buffer.from(file.data, 'base64')
            let length = Buffer.byteLength(buffer)

            res.setHeader('Content-Disposition', 'inline; filename=' + encodeURI(file.name))
            res.setHeader('Content-Length', length)
            //res.setHeader('Content-Range', `bytes 0-${length - 1}/${length}`)
            res.setHeader('Accept-Ranges', 'bytes')

            if (file.mimetype != 'other')
                res.setHeader('Content-Type', file.mimetype + '/' + path.extname(file.name).substring(1))
            
            let stream = Readable.from(buffer)
            stream.pipe(res)
        })
    })

    cfx.core.upload = upload;
    cfx.files = new Files(cfx);
}