const multer = require('multer')
const path = require('path')
const utils = require('./utils')
const storage = multer.memoryStorage();
const upload = multer({storage: storage});
const fs = require('fs');

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

    saveFiles(files, bundle) {
        if(!files || !files.length)
            return Promise.resolve({bundle: null, ids: []})

        return new Promise((resolve) => {
            bundle = parseInt(bundle)
            if (isNaN(bundle))
                resolve(null)
            else if(bundle >= 0)
                resolve(bundle)
            else {
                this.cfx.query('select coalesce(max(bundle_id) + 1, 1) as mx from file')
                .then(r => {
                    resolve(r[0].mx)
                })
            }
        })
        .then(bId => {
            return Promise.all(files.map(f => {
                let name = Buffer.from(f.originalname, 'latin1').toString('utf8')

                return this.cfx.query(`insert into file(name, mimetype, 
                    bundle_id, data) values(?,?,?,binary(?))`,
                    [name, utils.simplifyMimetype(f.mimetype), bId, f.buffer])
            }))
            .then(values => {
                let ids = []
                values.forEach(v => ids.push(v.insertId))
                return {
                    ids: ids,
                    bundle: bId
                }
            })
        })

    }
}

const Form = require('./forms').Form

exports.init = (cfx) => {
    if(!cfx.db || !cfx.forms)
        return true;
    
    cfx.forms.addForm(new Form({name: 'filetest', title: 'Фаил тест'},
    [
        {type: 'text', title: 'Папка', name: 'folder', optional: true, placeholder: 'default'},
        {type: 'file', title: 'Файлы', name: 'files', limit: 10},
    ],
    (data, erf, cfx) => {
        //console.log(data)
    },
    (data, out, cfx) => {
        cfx.files.saveFiles(data.files, 1)
        
    }
    ))

    cfx.core.app.get('/file', (req, res, next) => {
        cfx.files.getFile(req.query.id)
        .then(file => {
            if (!file)
                throw Error('Unknown file')

            let buffer = Buffer.from(file.data, 'base64')
            let length = Buffer.byteLength(buffer)

            res.setHeader('Content-Disposition', 'attachment; filename=' + encodeURI(file.name))
            res.setHeader('Content-Length', length)
            res.setHeader('Content-Range', `bytes 0-${length}`)

            if (file.mimetype != 'other')
                res.setHeader('Content-Type', file.mimetype + '/' + path.extname(file.name).substring(1))

            res.send(buffer)
        })
        .catch(err => {
            next(err)
        }) 
    });

    cfx.core.upload = upload;
    cfx.files = new Files(cfx);
}