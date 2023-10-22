class User {
    constructor(id, name, password, botscript) {
        this.id = id;
        this.name = name;
        this.password = password;
        this.chats = {};
        this.botscript = botscript;
    }

    isBot() {
        return this.botscript && this.botscript.userid == this.id;
    }

    addChat(id, privateName) {
        const obj = {id: id, privateName: privateName};
        this.chats[id] = obj;
    }

    removeChat(id) {
        delete this.chats[id];
    }
}

class Auth {
    users = {};
    
    removeUser(id) {
        this.users[id] = undefined;
    }

    isIdTaken(id) {
        return id in this.users;
    }

    addUser(...args) {
        const user = new User(...args);
        if (this.isIdTaken(user.id))
            throw Error('This userid is already taken.');
        this.users[user.id] = user;
        return user;
    }

    getUser(id) {
        const out = this.users[id];
        return out === undefined? null : out;
    }

    authSession(id, s) {
        s.userid = id;
        s.authenticated = true;
    }
}

let Form = require('./forms').Form;

const regForm = new Form(
    null, [
        {type: 'text', title: 'Имя аккаунта', name: 'id', placeholder: 'user108'},
        {type: 'text', title: 'Имя пользователя', name: 'name', placeholder: 'Илья Костин'},
        {type: 'password', title: 'Пароль', name: 'pw'},
        {type: 'password', title: 'Повторите пароль', name: 'pw-rep'},
        {type: 'checkbox', title: null, name: 'test', options: {'hey': 'Привет!', 'bye': 'Пока!'}, checked: ['bye']},
        {type: 'radio', title: 'random radio', name: 'test2', options: ['aadfadsf', 'badfasdf', 'cfasdfasdf'], checked: 1}
    ], (data, erf, cfx) => {

        if (!(/^[a-z0-9_]*$/.test(data['id'])))
            erf('id', 'Допустимые символы: a-z, 0-9, _');
        else if (data['id'].length < 1)
            erf('id', 'Как минимум 4 символа');
        else if (cfx.auth.isIdTaken(data['id']))
            erf('id', 'Данный ID занят')
        
        if (data['name'].length < 1)
            erf('name', 'Как минимум 4 символа');
        
        if (data['pw'].length < 1)
            erf('pw', 'Как минимум 4 символа');
        if (data['pw'] != data['pw-rep'])
            erf('pw-rep', 'Пароли не совпадают');
    }, (data, cfx) => {
        const user = cfx.auth.addUser(data['id'], data['name'], data['pw']);
        cfx.takeid(user.id);
    });

const loginForm = new Form(
    null, [
        {type: 'text', title: 'Имя аккаунта', name: 'id'},
        {type: 'password', title: 'Пароль', name: 'pw'}
    ], (data, erf, cfx) => {
        const user = cfx.auth.getUser(data['id']);
        if (user == null)
            erf('id', 'Не найдено');
        else if (user.password !== data['pw'])
            erf('pw', 'Неверный пароль');
    }, (data, cfx) => {
        cfx.takeid(data.id);
    }, {'Создать аккаунт': '/form?name=reg',
        'Забыли пароль?': '#'}
) 

exports.init = (cfx) => {
    if (!cfx.forms)
        return true;
    cfx.auth = new Auth();
    cfx.forms.addForm(loginForm, 'login', 'Вход');
    cfx.forms.addForm(regForm, 'reg', 'Регистрация');
}