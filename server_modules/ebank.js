let Form = require('./forms').Form;

class Ebank {
    constructor(cfx) {
        this.cfx = cfx;
    }

    setupUser(userid) {
        return this.cfx.query(`insert into ebank(user_id) values(${userid})`)
        .then(() => true, () => false);
    }

    setBalance(userid, balance) {
        return this.cfx.query(`update ebank set balance=${balance} where user_id=${userid}`)
        .then((data) => {
            return data.affectedRows > 0;
        }, (err) => {
            return false;
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

    getBalance(userid) {
        return this.cfx.query(`select balance from ebank where user_id=${userid}`)
        .then(data => {
            if (data.length == 0)
                return null;
            return data[0].balance;
        })
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
            {type: 'text', title: 'Сумма', name: 'amount'}
        ], (data, erf, cfx) => {

            let amount = parseInt(data.amount);
            
            if (isNaN(amount) || amount <= 0) {
                erf('amount', 'Некорректное значение')
                return;
            } else if(!cfx.user()) {
                erf('amount', 'Не удается получить доступ к кошельку')
                return;
            } else if(cfx.user().tag == data.usertag) {
                erf('usertag', 'Перевод самому себе')
                return;
            }
            
            return cfx.ebank.getBalance(cfx.user().id)
            .then(b => {
                if (b === null || b < amount) {
                    erf('amount', 'Недостаточно средств');
                }
                return cfx.auth.getUserByTag(data.usertag);
            })
            .then(user => {
                if (!user) {
                    erf('usertag', 'Пользователь не найден')
                    throw Error('err');
                }
                return user.id;
            })
            .then(id => {
                return cfx.ebank.changeBalance(id, amount);
            })
            .then(state => {
                if(!state) {
                    erf('usertag', 'Не удается получить доступ к кошельку');
                    throw Error('err');
                }
                return cfx.ebank.changeBalance(cfx.user().id, -amount);
            })
            .catch(e => {});

        }, () => {}
    ));

    cfx.core.app.get('/ebank', (req, res) => {
        let user = cfx.core.login(req, res, true);
        if(!user) return;

        cfx.ebank.getBalance(user.id)
        .then(b => {
            if (b !== null)
                return b;
            return cfx.ebank.setupUser(user.id)
            .then(() => {
                return 0;
            })
        })
        .then(b => {
            cfx.core.render(req, res, 'ebank', {
                balance: b
            })
        });

    })


}