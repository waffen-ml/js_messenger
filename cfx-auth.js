class User {
    constructor(id, name, password) {
        this.id = id;
        this.name = name;
        this.password = password;
        this.chats = {};
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

    addUser(user) {
        if (this.isIdTaken(user.id))
            throw Error('This userid is already taken.');
        this.users[user.id] = user;
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

const Form = require('./cfx-forms').Form;

const regForm = new Form(
    'reg', 'Регистрация', [
        {type: 'text', title: 'Имя аккаунта', name: 'id', placeholder: 'user108'},
        {type: 'text', title: 'Имя пользователя', name: 'name', placeholder: 'Илья Костин'},
        {type: 'password', title: 'Пароль', name: 'pw'},
        {type: 'password', title: 'Повторите пароль', name: 'pw-rep'}
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
        const user = new User(data['id'], data['name'], data['pw']);
        cfx.auth.addUser(user);
        cfx.takeid(user.id);
        return '/';
    });

const loginForm = new Form(
    'login', 'Вход', [
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
        return '/';
    }, {'Создать аккаунт': '/form?name=reg',
        'Забыли пароль?': '#'}
) 

const init = (cfx) => {
    cfx.auth = new Auth();
    cfx.forms.addForm(loginForm);
    cfx.forms.addForm(regForm);

    const saveliy = new User('nn_saveliy', 'Савелий', null)
    saveliy.onMessage = (msg, chat) => setTimeout(() => {
        console.log('Saveliy sees: ' + msg);
        let text = 'Пошел нахуй!';
        if (msg.content) text = 'Лох говорит:' + msg.content.text;
        chat.addMessage({sender: saveliy, content: cfx.utils.createContent(text, [])});
    }, 1000);
    cfx.auth.addUser(saveliy);
}

module.exports = {init, User};