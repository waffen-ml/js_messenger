class Auth {
    constructor(cfx) {
        this.cfx = cfx;
    }

    _getUserByQuery(query) {
        return this.cfx.query(`select * from user where ${query}`)
        .then((result) => {
            if(!result.length)
                return null;
            return result[0];
        })   
    }

    getUserById(id) {
        return this._getUserByQuery('id=' + id)
    }

    getUserByTag(tag) {
        return this._getUserByQuery(`tag="${tag}"`)
    }

    selQuery(selector, prefix) {
        let body = selector.substring(1);
        prefix ??= '';

        switch(sel[0]) {
            case '$':
                return prefix + `tag="${body}"`;
            case '@':
                return prefix + 'id=' + body;
            default:
                return null;
        }  
    }

    getUser(sel) {
        return this._getUserByQuery(this.selQuery(sel));
    }

    doesUserExist(sel) {
        return this.getUser(sel)
        .then((u) => {
            return u != null;
        })
    }

    addUser(name, tag, password) {
        return this.getUserByTag(tag)
        .then(u => {
            if (u) return;
            return this.cfx.query(`insert into user(name, tag, password) values ("${name}", "${tag}", "${password}")`)
            .then(() => {
                return this.getUserByTag(tag);
            });
        })
    }
}

let Form = require('./forms').Form;

const regForm = new Form(
    {name: 'reg', title: 'Регистрация'}, [
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

        return cfx.auth.getUserByTag(data.tag)
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
    {name: 'login', title: 'Вход'}, [
        {type: 'text', title: 'Имя аккаунта', name: 'tag'},
        {type: 'password', title: 'Пароль', name: 'pw'}
    ], (data, erf, cfx) => {
        return cfx.auth.getUserByTag(data.tag)
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
    cfx.forms.addForm(loginForm);
    cfx.forms.addForm(regForm);
}