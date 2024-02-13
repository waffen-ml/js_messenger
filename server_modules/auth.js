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
    if (!cfx.forms || !cfx.db || !cfx.files)
        return true;

    cfx.auth = new Auth(cfx);
    cfx.forms.addForm(loginForm);
    cfx.forms.addForm(regForm);

    cfx.core.app.get('/user', (req, res, next) => {
        return (req.query.id? cfx.auth.getUserById(req.query.id) : 
        (req.query.tag? cfx.auth.getUserByTag(req.query.tag) : Promise.resolve(null)))
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

    cfx.core.app.get('/getuser', (req, res) => {
        cfx.query('select id, name, tag from user where id='+req.query.id)
        .then(data => {
            if (data.length == 0)
                throw Error('unknown user')
            res.send({
                id: data.id,
                name: data.name,
                tag: data.tag
            })
        })
        .catch(err => {
            res.send(null)
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
            if (user.avatar_id)
                res.redirect('/file?id=' + user.avatar_id)
            else
                res.redirect('/public/useravatar.jpg')
        })


    })

}