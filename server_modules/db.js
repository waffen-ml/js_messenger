class Database {
    constructor(config, cfx, onconnected) {
        const mysql = require('mysql');
        this.cfx = cfx;
        this.conn = mysql.createConnection(config);
        this.conn.connect(err => {
            if (err) {
                console.log('Connection to DB failed: ' + err);
                return;
            }
            console.log('Connected to DB successfully!');

            if(onconnected)
                onconnected()
        })
        this.queryLib = {}
    }

    query(q, values) {
        return new Promise((resolve, reject) => {
            this.conn.query(q, values, (err, result, field) => {
                if (!err) 
                    resolve(result, field);
                else
                    reject(err)
            })
        })
        .then((...args) => new Promise((r) => r(...args)),
        (err) => {
            throw err
        })
        //.catch(err => {
        //    throw Error('MySQL error')
        //})
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
        host: '185.189.13.82',
        user: 'root',
        database: 'coffeetox',
        password: 'admin123',
        charset : 'utf8mb4'
    }, cfx, () => {
        keepConnection()
    })

    let keepCycleCount = 0

    function keepConnection() {
        keepCycleCount++

        if (keepCycleCount % 200 == 0)
            console.log('Keep cycle count: ' + keepCycleCount)

        cfx.query('select 1')
        .then(r => {
            setTimeout(keepConnection, 20 * 1000)
        })
    }

    cfx.query = (q, values) => cfx.db.query(q, values);

    const MySQLStore = require('express-mysql-session')(cfx.core.session)
    cfx.core.sessionStorage = new MySQLStore({
        createDatabaseTable: false,
        clearExpired: true,
	    checkExpirationInterval: 1000 * 60 * 30,
	    expiration: 1000 * 60 * 60 * 24 * 30
    }, cfx.db.conn)
    cfx.core.sessionMiddleware = cfx.core.session({
        store: cfx.core.sessionStorage,
        secret: 'coffee tox',
        cookie: {maxAge: 1000 * 60 * 60 * 24 * 30},
        saveUninitialized: false,
        resave: false
    })
}
