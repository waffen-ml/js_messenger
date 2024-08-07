const bcrypt = require("bcrypt")
const saltRounds = 8
const cfxAccountId = 71
const bankAccountId = 70

class Auth {
    constructor(cfx) {
        this.cfx = cfx;
        this.cfxAccountId = cfxAccountId
        this.bankAccountId = bankAccountId
    }

    getUser(id, tag) {
        if(!tag && !id)
            return Promise.resolve(null)
        let query = id? 'id=' + id : `tag="${tag}"`
        return this.cfx.query(`select id, tag, name, 
            avatar_id, balance, admin, bio, last_seen from user where ${query}`)
        .then(r => {
            return r.length? r[0] : null
        })
    }

    getUserById(id) {
        return this.getUser(id, null)
    }

    getUserByTag(tag) {
        return this.getUser(null, tag)
    }

    addUser(name, tag, unhashedPassword) {
        return this.getUserByTag(tag)
        .then(u => {
            if (u) return;
            return this.cfx.query(`insert into user(name, tag) 
                values (?, ?)`, [name, tag])
            .then(r => {
                return this.setPassword(r.insertId, unhashedPassword)
            })
            .then(() => {
                return this.getUserByTag(tag)
            })
        })
    }

    isAdmin(id) {
        return this.getUserById(id)
        .then(user => {
            return user && user.admin
        })
    }

    setPassword(userid, unhashedPassword) {
        return bcrypt.hash(unhashedPassword, saltRounds)
        .then(hash => {
            return this.cfx.query(`update user set password=? where id=?`, [hash, userid])
        })
    }

    comparePassword(userid, unhashedPassword) {
        return this.cfx.query(`select password from user where id=?`, [userid])
        .then(r => r[0].password)
        .then(hashedPassword => {
            return bcrypt.compare(unhashedPassword, hashedPassword)
        })
    }

    updateLastSeen(userid) {
        return this.cfx.query(`update user set last_seen=now() where id=?`, [userid])
    }

}

let Form = require('./forms').Form;


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
    //cfx.auth.setPassword(137, 'pisswasser')

    cfx.forms.addForm(new Form(
        {name: 'reg', title: 'Регистрация'}, [
            {type: 'text', title: 'Имя аккаунта', name: 'tag', placeholder: 'user108'},
            {type: 'text', title: 'Имя пользователя', name: 'name', placeholder: 'Илья Костин'},
            {type: 'password', title: 'Пароль', name: 'pw'},
            {type: 'password', title: 'Повторите пароль', name: 'pwrep'}
        ], (data, erf, _) => {
    
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
                    erf('tag', 'Этот тег занят!')
            })
    
        }, (data, user, vd, info) => {
            return cfx.auth.addUser(data.name, data.tag, data.pw)
            .then((u) => {
                info.req.session.userid = u.id
            })
        })
    )

    cfx.forms.addForm(new Form(
        {name: 'login', title: 'Вход'}, [
            {type: 'text', title: 'Имя аккаунта', name: 'tag'},
            {type: 'password', title: 'Пароль', name: 'pw'}
        ], (data, erf, _) => {
            return cfx.auth.getUserByTag(data.tag)
            .then(user => {
                if(!user) {
                    erf('tag', 'Не найдено')
                    return
                }
                return cfx.auth.comparePassword(user.id, data.pw)
                .then(r => {
                    if(!r)
                        erf('pw', 'Неверный пароль')
                    else
                        return user
                })
            })
        }, (data, _, vd, info) => {
            info.req.session.userid = vd.id
        }, {'Создать аккаунт': '/form?name=reg'}
    ))

    cfx.forms.addForm(new Form(
        {name:'editprofile', title: 'Редактировать профиль'},
        [
            {type: 'text', title: 'Имя', name: 'name'},
            {type: 'text', title: 'Тег', name: 'tag'},
            {type: 'text', title: 'Описание', name:'bio', optional: true}
        ],
        (data, erf, user) => {
            if (!(/^[a-z0-9_]*$/.test(data.tag)))
                erf('tag', 'Допустимые символы: a-z, 0-9, _')
            else if (data.tag.length < 4)
                erf('tag', 'Как минимум 4 символа')
            
            if (data.name.length < 4)
                erf('name', 'Как минимум 4 символа')
    
            return cfx.auth.getUserByTag(data.tag)
            .then((user2) => {
                if (user2 && user2.id != user.id)
                    erf('tag', 'Этот тег занят')
            })
        },
        (data, user, vd) => {
            return Promise.all([
                cfx.query('update user set name=? where id=?', [data.name, user.id]),
                cfx.query('update user set tag=? where id=?', [data.tag, user.id]),
                cfx.query('update user set bio=? where id=?', [data.bio ?? '', user.id])
            ])
        }
    ))

    cfx.forms.addForm(new Form(
        {name:'changepassword', title: 'Сменить пароль'},
        [
            {type: 'password', title: 'Старый пароль', name: 'oldpass'},
            {type: 'password', title: 'Новый пароль', name: 'newpass'},
            {type: 'password', title: 'Повторите новый пароль', name:'newpassrep'}
        ],
        (data, erf, user) => {
    
            if (data.newpass.length < 4) {
                erf('newpass', 'Как минимум 4 символа')
                return
            }
    
            else if (data.newpass != data.newpassrep) {
                erf('newpass', 'Пароли не совпадают')
                return
            }
    
            return cfx.auth.comparePassword(user.id, data.oldpass)
            .then(r => {
                if(!r)
                    erf('oldpass', 'Неверный пароль')
                else
                    return cfx.auth.setPassword(user.id, data.newpass)
            })
        },
        (data, _, cfx) => {
        }
    ));

    cfx.core.safePost('/apilogin', async (_, req, res) => {
        let user = await cfx.auth.getUser(null, req.body.tag)
        if(!user || !await cfx.auth.comparePassword(user.id, req.body.password))
            throw Error('Wrong credentials')
        req.session.userid = user.id
        return {success: 1}
    })

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

    cfx.core.safeGet('/getuserinfo', (_, req, res) => {
        return cfx.auth.getUser(req.query.id, req.query.tag)
        .then(data => {
            return data ?? {}
        })
    })

    cfx.core.safeGet('/getuser', (_, req, res) => {
        return cfx.auth.getUser(req.query.id, req.query.tag)
        .then(data => {
            return data ?? {}
        })
    })

    cfx.core.safePost('/setavatar', (user, req, res) => {
        req.file.originalname = 'avatar.jpg'
        return cfx.files.saveFiles([req.file])
        .then(ids => {
            return cfx.query(`update user set avatar_id=? where id=?`, [ids[0], user.id])
        })
        .then(() => {
            return {success:1}
        })

    }, cfx.core.upload.single('avatar'), true)

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

}