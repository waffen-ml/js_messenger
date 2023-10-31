const mysql = require('mysql');
const conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'coffetox',
    password: 'admin'
})

conn.connect(err => {
    if (err) {
        console.log('Error: ' + err);
        return;
    }
    console.log('Success!')
})

conn.query('select * from user', (err, result, field) => {
    console.log(result[0].id);
})