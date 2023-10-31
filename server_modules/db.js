class Database {
    constructor(config) {
        const mysql = require('mysql');
        this.conn = mysql.createConnection(config);
        this.conn.connect(err => {
            if (err) {
                console.log('Connection to DB failed: ' + err);
                return;
            }
            console.log('Connected to DB successfully!');
        })
    }

    query(q) {
        return new Promise((resolve, reject) => {
            this.conn.query(q, (err, result, field) => {
                if (!err) 
                    resolve(result, field);
                else
                    reject(err);
            })
        })
    }
}

exports.init = (cfx) => {
    cfx.db = new Database({
        host: 'localhost',
        user: 'root',
        database: 'coffetox',
        password: 'admin'
    });
    cfx.query = (q) => cfx.db.query(q);
}