// engine
const express = require('express')
const app = express()
const fs = require('fs')
const pug = require('pug')

const keyPath = __dirname + `/../sslcert/key.pem`
const certPath = __dirname + `/../sslcert/cert.pem`


const server = require('https').createServer({
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
}, app)

const peerServer = require('peer').PeerServer({
  port: 3004,
  ssl: {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  }
})

const unsecureServer = require('http').createServer((req, res) => {
    res.writeHead(302, {
      'Location': 'https://coffeetox.ru' + req.url
    })
    res.end()
})

const SocketServer = require("socket.io").Server
const io = new SocketServer(server)
const session = require('express-session')
const cors = require('cors')

app.set('view engine', 'pug');
app.use(cors());
app.use(express.json())

app.use('/public', express.static('public'))
app.use('/cmodules', express.static('client_modules'))
app.use('/node_modules', express.static(__dirname + '/node_modules/'));

function render(req, res, page, params) {
    res.render(page, {
        nav: {
            'login': {
                text: 'Войти',
                link: '/form?name=login'
            },
            'coffee_chat': {
                text: 'Кофейный чат☕',
                link: '/chat?id=318'
            },
            'messages': {
                text: 'Сообщения',
                link: '/chatlist'
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
            },
            'logout': {
                text: 'Выйти',
                link: '/logout'
            }
        },
        cfx: cfx,
        utils: cfx.utils,
        clientUtils: cfx.clientUtils,
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

function updateUser(user) {
    if(!user)
        return Promise.resolve(null)

    return cfx.auth.updateLastSeen(user.id)
}

function renderlessQuery(req, res, reqlogin, handler) {
    let userid = req.session.userid
    if(!userid && reqlogin) {
        res.send({
            error: 'User is not authorized'
        })
        return
    }
    cfx.auth.getUser(userid)
    .then(user => {
        return updateUser(user)
        .then(() => handler(user, req, res))
    })
    .then(r => {
        if (r)
            res.send(r)
    })
    .catch(err => {
        console.log(err)
        res.send({
            error: err.message
        })
    })
}

function safePost(pattern, onpost, upl, reqlogin) {
    upl ??= cfx.core.upload.none()

    app.post(pattern, upl, (req, res) => {
        renderlessQuery(req, res, reqlogin, onpost)
    })
}

function safeGet(pattern, onget, reqlogin) {
    app.get(pattern, (req, res) => {
        renderlessQuery(req, res, reqlogin, onget)
    })
}

function safeRender(pattern, onget, reqlogin) {
    app.get(pattern, (req, res, next) => {
        let userid = req.session.userid
        if(!userid && reqlogin) {
            res.redirect('/form?name=login&next='
            + encodeURIComponent(req.url))
            return
        }
        
        cfx.auth.getUser(userid)
        .then(user => {
            return updateUser(user)
            .then(() => onget(user, req, res))
            .then(data => {
                if(!data)
                    return
                data.user = user
                render(req, res, data.render, data)
            })
        })
        .catch(err => {
            console.log(err)
            res.status(500)
            render(req, res, 'error', {
                error: err.message
            })
        })
    })
}

const cfx = require('./cfx-main.js').cfx;

const sessionMiddleware = (req, res, next) => {
    if(cfx.core.sessionMiddleware)
        cfx.core.sessionMiddleware(req, res, next)
    else
        next(req, res)
}

app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);


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
    safeRender: safeRender,
    safePost: safePost
})

cfx.clientUtils = require('./client_modules/utils/script.js').utils

safeRender('/settings', (user, req, res) => {
    return {
        render: 'settings',
    }
}, true)

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

server.listen(443, () => {
  console.log('CFX is running');
});

unsecureServer.listen(80, () => {})
