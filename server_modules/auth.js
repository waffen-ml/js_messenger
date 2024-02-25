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

    getUser(id, tag) {
        return id? this.getUserById(id) : tag? this.getUserByTag(tag) : Promise.resolve(null)
    }

    addUser(name, tag, password) {
        return this.getUserByTag(tag)
        .then(u => {
            if (u) return;
            return this.cfx.query(`insert into user(name, tag, password) 
                values (?, ?, ?)`, [name, tag, password])
            .then(() => {
                return this.getUserByTag(tag);
            });
        })
    }

    isAdmin(id) {
        return this.getUserById(id)
        .then(user => {
            return user && user.admin
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

const banForm = new Form(
    {name: 'ban', title: 'Забанить'},
    [
        {type: 'text', title: 'Тег пользователя', name: 'tag'},
        {type: 'text', title: 'Срок', name: 'time'},
        {type: 'text', title: 'Причина', name: 'reason', optional: true}
    ], (data, erf, cfx) => {
        let observer = cfx.user()
        if (!observer) {
            erf('tag', 'Вы не админ')
            return
        }
        return cfx.auth.isAdmin(observer.id)
        .then(admin => {
            if(!admin)
                erf('tag', 'Вы не админ')
        })

    }
)

exports.init = (cfx) => {
    if (!cfx.forms || !cfx.db || !cfx.files)
        return true;

    cfx.auth = new Auth(cfx);
    cfx.forms.addForm(loginForm);
    cfx.forms.addForm(regForm);

    cfx.core.app.get('/auth', (req, res) => {
        let user = cfx.core.login(req, res, false)
        res.send(user? user : {})
    })

    cfx.core.app.get('/user', (req, res, next) => {
        return cfx.auth.getUser(req.query.id, req.query.tag)
        .then((user) => {
            if(!user)
                throw Error('Пользователь не найден')
            cfx.core.render(req, res, 'user', {
                target: user
            })
        })
        .catch(err => {
            next(err);
        })
    })

    cfx.core.safeGet('/getuser', (req, res) => {
        return cfx.auth.getUser(req.query.id, req.query.tag)
        .then(data => {
            if(!data)
                return {}
            return {
                id: data.id,
                name: data.name,
                tag: data.tag,
                avatar_id: data.avatar_id
            }
        })
    })

    cfx.core.app.post('/setavatar', cfx.core.upload.single('avatar'), (req, res) => {
        let user = cfx.core.login(req, res, false)
        if(!user) {
            res.send({success:false})
            return
        }
        req.file.originalname = 'avatar.jpg'
        cfx.files.saveFiles([req.file])
        .then(r => {
            let avatarId = r.ids[0]
            return cfx.query('update user set avatar_id=? where id=?', [avatarId, user.id])
        })
        .then(r => {
            res.send({success: true})
        })
    })

    cfx.core.app.get('/getuseravatar', (req, res) => {
        cfx.auth.getUserById(req.query.id)
        .then(user => {
            if (user && user.avatar_id)
                res.redirect('/file?id=' + user.avatar_id)
            else {
                let capyid = !user? 0 : user.id % 6
                res.redirect(`/public/useravatar/capybara${capyid}.png`)
            }
        })


    })

}