class Auth {
    constructor(cfx) {
        this.cfx = cfx;
    }

    getUser(tag) {
        return this.cfx.query(`select * from user where tag="${tag}"`)
        .then((result) => {
            if (!result.length)
                return null;
            return result[0];
        })
    }

    doesUserExist(tag) {
        return this.getUser(tag)
        .then((u) => {
            return u != null;
        })
    }

    addUser(name, tag, password) {
        return this.getUser(tag)
        .then(u => {
            if (u) return;
            return this.cfx.query(`insert into user(name, tag, password) values ("${name}", "${tag}", "${password}")`)
            .then(() => {
                return this.getUser(tag);
            });
        })
    }
}

let Form = require('./forms').Form;

const regForm = new Form(
    null, [
        {type: 'text', title: 'Имя аккаунта', name: 'tag', placeholder: 'user108'},
        {type: 'text', title: 'Имя пользователя', name: 'name', placeholder: 'Илья Костин'},
        {type: 'password', title: 'Пароль', name: 'pw'},
        {type: 'password', title: 'Повторите пароль', name: 'pwrep'}
    ], (data, erf, cfx) => {

        if (!(/^[a-z0-9_]*$/.test(data.tag)))
            erf('tag', 'Допустимые символы: a-z, 0-9, _');
        else if (data.tag.length < 1)
            erf('tag', 'Как минимум 4 символа');
        
        if (data.name.length < 4)
            erf('name', 'Как минимум 4 символа');
        
        if (data.pw.length < 4)
            erf('pw', 'Как минимум 4 символа');
        else if (data.pw != data.pwrep)
            erf('pwrep', 'Пароли не совпадают');
        
        if (erf())
            return;

        return cfx.auth.getUser(data.tag)
        .then((user) => {
            if (user)
                erf('tag', 'Это ID занято')
        })

    }, (data, _, cfx) => {
        return cfx.auth.addUser(data.name, data.tag, data.pw)
        .then((u) => {
            cfx.authSession(u);
        })
    });

const loginForm = new Form(
    null, [
        {type: 'text', title: 'Имя аккаунта', name: 'tag'},
        {type: 'password', title: 'Пароль', name: 'pw'}
    ], (data, erf, cfx) => {
        return cfx.auth.getUser(data.tag)
        .then(user => {
            if(!user)
                erf('tag', 'Не найдено');
            else if(user.password != data.pw)
                erf('pw', 'Неверный пароль')
            else
                return user;
        })
    }, (_, user, cfx) => {
        cfx.authSession(user);
    }, {'Создать аккаунт': '/form?name=reg',
        'Забыли пароль?': '#'}
) 

exports.init = (cfx) => {
    if (!cfx.forms || !cfx.db)
        return true;
    cfx.auth = new Auth(cfx);
    cfx.forms.addForm(loginForm, 'login', 'Вход');
    cfx.forms.addForm(regForm, 'reg', 'Регистрация');
}