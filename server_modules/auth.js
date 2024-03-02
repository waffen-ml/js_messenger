const bcrypt = require("bcrypt")
const saltRounds = 8

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
        else if (data.tag.length < 4)
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

const editProfileForm = new Form(
    {name:'editprofile', title: 'Редактировать профиль'},
    [
        {type: 'text', title: 'Имя', name: 'name'},
        {type: 'text', title: 'Тег', name: 'tag'},
        {type: 'text', title: 'Описание', name:'bio', optional: true}
    ],
    (data, erf, cfx) => {
        if (!(/^[a-z0-9_]*$/.test(data.tag)))
            erf('tag', 'Допустимые символы: a-z, 0-9, _')
        else if (data.tag.length < 4)
            erf('tag', 'Как минимум 4 символа')
        
        if (data.name.length < 4)
            erf('name', 'Как минимум 4 символа')

        return cfx.auth.getUserByTag(data.tag)
        .then((user) => {
            if (user && user.id != cfx.user().id)
                erf('tag', 'Этот тег занят')
        })
    },
    (data, _, cfx) => {
        let userid = cfx.user().id
        return Promise.all([
            cfx.query('update user set name=? where id=?', [data.name, userid]),
            cfx.query('update user set tag=? where id=?', [data.tag, userid]),
            cfx.query('update user set bio=? where id=?', [data.bio ?? '', userid])
        ])
    }
)

const changePasswordForm = new Form(
    {name:'changepassword', title: 'Сменить пароль'},
    [
        {type: 'password', title: 'Старый пароль', name: 'oldpass'},
        {type: 'password', title: 'Новый пароль', name: 'newpass'},
        {type: 'password', title: 'Повторите новый пароль', name:'newpassrep'}
    ],
    (data, erf, cfx) => {

        if (data.newpass.length < 4) {
            erf('newpass', 'Как минимум 4 символа')
            return
        }

        else if (data.newpass != data.newpassrep) {
            erf('newpass', 'Пароли не совпадают')
            return
        }

        return cfx.auth.getUser(cfx.user().id)
        .then((user) => {
            if (user.password != data.oldpass)
                erf('oldpass', 'Неверный пароль')
        })
    },
    (data, _, cfx) => {
        let userid = cfx.user().id
        return cfx.query('update user set password=? where id=?', [data.newpass, userid])
    }
)

exports.init = (cfx) => {
    if (!cfx.forms || !cfx.db || !cfx.files)
        return true;

    cfx.auth = new Auth(cfx);
    cfx.forms.addForm(loginForm);
    cfx.forms.addForm(regForm);
    cfx.forms.addForm(editProfileForm);
    cfx.forms.addForm(changePasswordForm);

    cfx.core.safeGet('/auth', (user, req, res) => {
        if(!user)
            return {}
        return cfx.auth.getUser(user.id)
    })

    cfx.core.safeRender('/user', (_, req, res) => {
        return cfx.auth.getUser(req.query.id, req.query.tag)
        .then((user) => {
            if(!user)
                throw Error('Пользователь не найден')
            return {
                render: 'user',
                target: user
            }
        })
    })

    cfx.core.safeGet('/getuser', (_, req, res) => {
        return cfx.auth.getUser(req.query.id, req.query.tag)
        .then(data => {
            if(!data)
                return {}
            return {
                id: data.id,
                name: data.name,
                tag: data.tag,
                bio: data.bio,
                avatar_id: data.avatar_id
            }
        })
    })

    cfx.core.app.post('/setavatar', cfx.core.upload.single('avatar'), (req, res) => {
        try {
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
        }
        catch(err) {
            console.log(err)
        }
    })

    cfx.core.safeGet('/deleteuseravatar', (user, req, res) => {
        return cfx.auth.getUser(u.id)
        .then(user => {
            return Promise.all([
                //cfx.query('delete from file where id=?', [user.avatar_id]),
                cfx.query('update user set avatar_id=null where id=?', [user.id])
            ])
        })
        .then(() => {
            return {
                success:1
            }
        })
    }, true)

    cfx.core.safeGet('/getuseravatar', (_, req, res) => {
        return cfx.auth.getUserById(req.query.id)
        .then(user => {
            if (user && user.avatar_id)
                res.redirect('/file?id=' + user.avatar_id)
            else {
                let capyid = !user? 0 : user.id % 11
                res.redirect(`/public/useravatar/capybara${capyid}.png`)
            }
        })


    })

    cfx.core.safeRender('/allusers', (_, req, res) => {
       return cfx.query(`select * from user`)
       .then(users => {
            return {
                render: 'allusers',
                users: users
            }
       })
    })

    cfx.core.safeGet('/exitsessions', (user, req, res) => {
        cfx.core.sessionStorage.all((err, sess) => {
            Object.keys(sess).forEach(k => {
                if(k == req.sessionID)
                    return
                else if(sess[k].user && sess[k].user.id == user.id)
                    cfx.core.sessionStorage.destroy(k)
            })
        })
        return {
            success: 1
        }

    }, true)

    cfx.query(`select id, password from user`)
    .then(r => {

        r.forEach(w => {
            bcrypt
            .hash(w.password, saltRounds)
            .then(hash => {
                cfx.query(`update user set password=? where id=?`, [hash, parseInt(r.id)])
            })
        })

    })

}