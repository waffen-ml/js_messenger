class Database {
    constructor(config, cfx) {
        const mysql = require('mysql');
        this.cfx = cfx;
        this.conn = mysql.createConnection(config);
        this.conn.connect(err => {
            if (err) {
                console.log('Connection to DB failed: ' + err);
                return;
            }
            console.log('Connected to DB successfully!');
        })
        this.queryLib = {}
    }

    query(q, values) {
        return new Promise((resolve, reject) => {
            this.conn.query(q, values, (err, result, field) => {
                if (!err) 
                    resolve(result, field);
                else
                    reject(err);
            })
        })
    }

    loadFile(queryName) {
        return new Promise((resolve, reject) => {
            
            if (this.queryLib[queryName] !== undefined)
                return resolve(this.queryLib[queryName])

            this.cfx.core.fs.readFile(__dirname + '/../querylib/' + queryName + '.txt', (err, data) => {
                if (err) {
                    if (err.code == 'ENOENT')
                        this.queryLib[queryName] = null
                    return reject(err)
                }
                this.queryLib[queryName] = data.toString()
                resolve(data.toString())
            })

        })
    }

    executeFile(queryName, params) {
        return this.loadFile(queryName)
        .then(text => {
            if (!text)
                throw Error("Invalid query")
            Object.keys(params).forEach(k => {
                text = text.replaceAll(`{${k}}`, params[k])
            })
            return this.query(text)
        })
    }


}

exports.init = (cfx) => {
    cfx.db = new Database({
        host: 'localhost',
        user: 'root',
        database: 'coffetox',
        password: 'admin'
    }, cfx);
    cfx.query = (q, values) => cfx.db.query(q, values);

    //const mysql = require('mysql');
    //let conn = mysql.createConnection({
    //    host: 'ilyaspqx.beget.tech',
    //    user: 'ilyaspqx_db',
    //    database: 'ilyaspqx_db',
    //    password: 'Pig66666'
    //});
    //conn.connect(err => {
    //    if (err) {
    //        console.log('FAILED: ' + err);
    //        return;
    //    }
    //    conn.query('select 1', (r) => {
    //        console.log(r)
    //    })
    //})
}