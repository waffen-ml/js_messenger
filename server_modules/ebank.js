const Form = require('./forms').Form
const utils = require('./utils')
const ebankErrors = utils.makeEnum([
    "UNKNOWN_SENDER", "UNKNOWN_RECEIVER",
    "LACKING_BALANCE", "INVALID_AMOUNT",
    "SELF_TRANSACTION"
])

class Ebank {
    constructor(cfx) {
        this.cfx = cfx;
    }

    makeTransaction(from_id, to_id, amount, comment="") {
        if(!amount || amount < 0)
            return new Promise(() => {
                throw Error(ebankErrors.INVALID_AMOUNT)
            })
        else if(from_id == to_id)
            return new Promise(() => {
                throw Error(ebankErrors.SELF_TRANSACTION)
            })
        return this.getBalance(from_id)
        .then(b => {
            if (b === null)
                throw Error(ebankErrors.UNKNOWN_SENDER)
            if (b < amount)
                throw Error(ebankErrors.LACKING_BALANCE)
            return this.changeBalance(from_id, -amount)
        })
        .then(() => {
            return this.changeBalance(to_id, amount)
        })
        .then(s => {
            if(!s) {
                return this.changeBalance(from_id, amount)
                .then(() => {
                    throw Error(ebankErrors.UNKNOWN_RECEIVER)
                })
            }
            return this.cfx.query('insert into ebank_transaction(from_id, to_id, amount, comment, datetime) values(?, ?, ?, ?, now())',
                [from_id, to_id, amount, comment])
        })
    }
    
    setBalance(userid, balance) {
        return this.cfx.query('update user set balance=? where id=?', [balance, userid])
        .then(r => {
            return r.affectedRows > 0
        })
    }

    getBalance(userid) {
        return this.cfx.query('select balance from user where id=?', [userid])
        .then(r => {
            return r.length? r[0].balance : null
        })
    }

    getStats(userid) {
        return this.cfx.query(`select balance, balance/(select sum(balance) from user)*100 
            as capital from user where id=${userid} and tag!="creditsuisse"`)
        .then(r => {
            return r[0]
        })
    }

    getUserTransactions(userid) {
        return this.cfx.db.executeFile('transactions', {id: userid})
        .then(transactions => {
            return transactions.map(t => {
                let from_me = userid == t.from_id

                return {
                    target_id: from_me? t.to_id : t.from_id,
                    target_name: from_me? t.to_name : t.from_name,
                    target_tag: from_me? t.to_tag : t.from_tag,
                    datetime: t.datetime,
                    comment: t.comment,
                    amount: t.amount,
                    from_me: from_me
                }
            })
        })
    }

    changeBalance(userid, diff) {
        return this.getBalance(userid)
        .then((b) => {
            if(b === null)
                return false;
            return this.setBalance(userid, b + diff);
        })
    }

    getCapitalLeaderboard() {
        return this.cfx.db.executeFile('capitallb', {})
    }
}

exports.init = (cfx) => {
    if(!cfx.forms)
        return true;

    cfx.ebank = new Ebank(cfx);

    cfx.forms.addForm(new Form(
        {name: 'ebank'},
        [
            {type: 'text', title: 'Получатель', name: 'usertag'},
            {type: 'text', title: 'Сумма', name: 'amount'},
            {type: "text", title: 'Комментарий', name: 'comment', optional:true}
        ], (data, erf, cfx) => {

            let from_id = cfx.user().id
            let to_tag = data.usertag
            let amount = parseInt(data.amount)
            let comment = data.comment
            
            return cfx.auth.getUserByTag(to_tag)
            .then(to_user => {
                if (!to_user)
                    throw Error(ebankErrors.UNKNOWN_RECEIVER)
                return cfx.ebank.makeTransaction(from_id, to_user.id, amount, comment)
            })
            .then(() => {
                
            })
            .catch(err => {
                switch(err.message) {
                    case ebankErrors.INVALID_AMOUNT:
                        erf('amount', 'Некорректное значение')
                        break
                    case ebankErrors.UNKNOWN_RECEIVER:
                        erf('usertag', 'Не найдено')
                        break
                    case ebankErrors.LACKING_BALANCE:
                        erf('amount', 'Недостаточно средств')
                        break
                    case ebankErrors.SELF_TRANSACTION:
                        erf('usertag', 'Перевод себе')
                        break
                    default:
                        throw err
                }
            })

        }, () => {}
    ));

    cfx.core.app.get('/ebank', (req, res) => {
        let user = cfx.core.login(req, res, true);
        if(!user) return;

        cfx.ebank.getStats(user.id)
        .then(s => {
            cfx.core.render(req, res, 'ebank', {
                balance: s.balance,
                capital: s.capital,
            })
        })
    })

    cfx.core.app.get('/gettransactions', (req, res) => {
        let user = cfx.core.login(req, res, true);
        if(!user) return;

        cfx.ebank.getUserTransactions(user.id)
        .then(t => {
            res.send(t)
        })
    })

    cfx.core.app.get('/capitallb', (req, res) => {
        cfx.ebank.getCapitalLeaderboard()
        .then(lb => {
            cfx.core.render(req, res, 'capitallb', {
                lb: lb
            })
        })
    })

    cfx.core.app.get('/maketransaction', (req, res) => {
        let user = cfx.core.login(req, res, false)

        if(!user) {
            res.send({
                success: false,
                error: ebankErrors.UNKNOWN_SENDER
            })
            return
        }

        let to_id = req.query.id
        let amount = parseInt(req.query.amount)
        let comment = req.query.comment
        cfx.ebank.makeTransaction(user.id, to_id, amount, comment)
        .then(r => {
            res.send({
                success: true,
                error: null
            })
        })
        .catch((err) => {
            res.send({
                success: false,
                error: err.message
            })
        })
        
    })


}
