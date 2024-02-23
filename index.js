// engine
const express = require('express');
const app = express();
const fs = require('fs');
const pug = require('pug');
const server = require('https').createServer({
    key: fs.readFileSync(__dirname + `/../sslcert/privkey.pem`),
    cert: fs.readFileSync(__dirname + `/../sslcert/cert.pem`)
}, app);
const unsecureServer = require('http').createServer((req, res) => {
    res.writeHead(302, {
      'Location': 'https://coffeetox.ru' + req.url
    })
    res.end()
})

//const server = require('https').createServer({
//    key: fs.readFileSync(__dirname + '/cert/key.pem'),
//    cert: fs.readFileSync(__dirname + '/cert/cert.pem')
//}, app);

const SocketServer = require("socket.io").Server
const io = new SocketServer(server)
const session = require('express-session')
const cors = require('cors')

app.set('view engine', 'pug');
app.use(cors());

const sessionMiddleware = session({
    secret: 'coffee tox',
    cookie: {maxAge: 1000 * 60 * 60 * 48},
    saveUninitialized: false,
    resave: false
});

app.use('/public', express.static('public'))
app.use('/cmodules', express.static('client_modules'))
app.use('/node_modules', express.static(__dirname + '/node_modules/'));

app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

function render(req, res, page, params) {
    res.render(page, {
        nav: {
            'messages': {
                text: 'Сообщения',
                link: '/ebank'
            },
            'bank': {
                text: 'Банк CFX',
                link: '/ebank'
            },
            'create_post': {
                text: 'Создать пост',
                link: '/create_post'
            },
            'friends': {
                text: 'Друзья',
                link: '/friends'
            }
        },
        user: cfx.as(req.session).user(),
        cfx: cfx,
        utils: cfx.utils,
        ...params
    });
}

function redirectToLogin(req, res) {
    res.redirect('/form?name=login&next='
    + encodeURIComponent(req.url))
}

function login(req, res, requireLogin) {
    let user = req.session.user;
    if (!user && requireLogin)
        redirectToLogin(req, res)
    return user;
}

function plogin(req, res, requireLogin) {
    return new Promise((resolve, reject) => {
        let user = login(req, res, requireLogin)
        if(!user && requireLogin)
            reject()
        resolve(user)
    })
}


function safeGet(pattern, onget, reqlogin) {
    app.get(pattern, (req, res) => {
        try {
            let user = req.session.user
            if(!user && reqlogin) {
                res.send({
                    error: 'User is not authorized'
                })
                return
            }
            Promise.resolve(onget(user, req, res))
            .then(r => {
                res.send(r)
            })
        }
        catch(err) {
            res.send({
                error: err.message
            })
        }
    })
}

function safeRender(pattern, onget, reqlogin) {
    app.get(pattern, (req, res, next) => {
        try {
            let user = req.session.user
            if(!user && reqlogin) {
                res.redirect('/form?name=login&next='
                + encodeURIComponent(req.url))
                return
            }
    
            Promise.resolve(onget(user, req, res))
            .then(data => {
                render(req, res, data.render, data)
            })
        }
        catch(err) {
            res.status(500);
            render(req, res, 'error', {
                error: err.message
            })
        }
    })
}

const cfx = require('./cfx-main.js').cfx;
cfx.init({
    fs: fs,
    app: app,
    pug: pug,
    io: io,
    session: session,
    render: render,
    login: login,
    plogin: plogin,
    safeGet: safeGet,
    safeRender: safeRender
})

app.get('/createchat', (req, res) => {
    const user = login(req, res, true);
    const user2id = req.query.userid;
    const user2 = cfx.auth.getUser(user2id);

    if (!user || !user2 || user.id == user2id) {
        res.send({success: false});
        return;
    }

    const chatid = cfx.chats.createChat('', false);
    cfx.chats.addUserToChat(user.id, chatid, user2.name);
    cfx.chats.addUserToChat(user2.id, chatid, user.name);

    res.send({success: true});

});

app.get('/test', (req, res) => {
    render(req, res, 'test');
});

app.get('/form', (req, res) => {
    const form = cfx.forms.getForm(req.query.name);
    render(req, res, 'form', { form: form});
});

app.post('/form', cfx.core.upload.any(), (req, res) => {
    let data = req.body;

    req.files.forEach(file => {
        const fn = file.fieldname;
        if (!data[fn])
            data[fn] = [];
        data[fn].push(file);
    });

    cfx.forms.passData(
        req.query.name,
        data, cfx.as(req.session))
    .then(out => {
        //console.log(out);
        res.send(out);
    })
});     

app.get('/logout', (req, res) => {
    req.session.destroy();
    let next = req.query.next || '/';
    res.redirect(next);
});

app.get('/login', (req, res) => {
    res.redirect('/form?name=login');
});

app.get('/getform', (req, res) => {
    const name = req.query.name;
    const form = cfx.forms.getForm(name);

    if(!form) {
        res.send({});
        return;
    }

    res.send({
        title: form.meta.title,
        html: pug.renderFile('./utils/formU.pug', {
            form: form
        })
    })
});

app.get('/croptest', (req, res) => {
    let user = login(req, res, true)
    if(!user) return
    render(req, res, 'croptest')
})

app.use((req, res, next) => {
    next(new Error('Not found'))
})

server.listen(443, () => {
  console.log('CFX is running');
});

unsecureServer.listen(80, () => {})