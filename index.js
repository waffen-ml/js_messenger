// engine
const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const pug = require('pug');
const server = require('http').createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const session = require('express-session');
const cors = require('cors');
const multer = require('multer');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'data');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({storage: storage});

app.set('view engine', 'pug');
app.use(cors());

const sessionMiddleware = session({
    secret: 'coffee tox',
    cookie: {maxAge: 1000 * 60 * 60},
    saveUninitialized: false,
    resave: false
});

app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

function render(req, res, page, params) {
    console.log("RENDER " + req.sessionID);
    const user = cfx.as(req.session).user();

    res.render(page, {
        nav: {
            'Кофейный чат 🗨️': '/chat?id=0',
            'Сообщения': '/chatlist',
            'Игры 🎮': '/gamelist'
        },
        user: user,
        ...params
    });
}

function login(req, res, requireLogin) {
    const user = {id: 25, tag: '1234', password:'1234'};//req.session.user;
    if (!user && requireLogin)
        res.redirect('/form?name=login');
    return user;
}

const cfx = require('./cfx-main.js').cfx;
cfx.init({
    fs: fs,
    app: app,
    pug: pug,
    upload: upload,
    session: session,
    render: render,
    login: login
});
//cfx.chats.createChat('Coffee chat');
cfx.auth.addUser('t1', 'Ilya Kostin', '1');
cfx.auth.addUser('t2', 'Another guy', '1');


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

app.get('/chatlist', (req, res) => {
    const user = login(req, res, true);
    if(!user) return;

    chatsData = Object.values(user.chats).map((cw) => {
        return {
            id: cw.id,
            privateName: cw.privateName,
            obj: cfx.chats.getChat(cw.id)
        }
    });

    render(req, res, 'chatlist', {
        chats: chatsData
    })
});

app.get('/', (req, res) => {
    render(req, res, 'index');
});

app.get('/test', (req, res) => {
    render(req, res, 'test');
});

app.get('/chat', (req, res) => {
    const user = login(req, res, true);

    if (!user)
        return;

    cfx.chats.getChat(req.query.id)
    .then((chat) => {
        if(!chat)
            throw new Error('Chat was not found.')

        return chat.containsUser(user.id)
        .then(r => {
            if(!r) throw new Error('User is not in the chat.');
            return chat.getLastMessages(30);
        }).then((messages) => {
            render(req, res, 'chat', {
                observer: user,
                messages: messages,
                chatname: chat.name
            });
        })
    })
    .catch((err) => {
        console.log(err)
        res.redirect('/');
    });
});

app.get('/form', (req, res) => {
    const form = cfx.forms.getForm(req.query.name);
    render(req, res, 'form', { form: form});
});

app.post('/form', upload.any(), (req, res) => {
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
        if (out._out === undefined)
            req.files.forEach(f => fs.unlink(f.path, () => {}));
        console.log(out);
        res.send(out);
    })
});     

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/login', (req, res) => {
    res.redirect('/form?name=login');
});

app.get('/file', (req, res) => {
    const id = req.query.id;
    res.sendFile(__dirname + '/data/' + id);
});

app.post('/sendmsg', upload.array('files'), (req, res) => {
    let sender = login(req, res, true);
    if(!sender) return;

    cfx.chats.getChat(req.query.id)
    .then(chat => {
        if(!chat)
            return;
        chat.addMessage(sender.id, req.body.text);
        res.send({msgid : 0});
    })
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


async function getSocketByUserId(userid) {
    let sockets = await io.in('u:' + userid).fetchSockets();
    if (sockets.length < 1) return null;
    return sockets[0];
}

async function displayMessage(msg, chatid) {
    let u = pug.compileFile('utils/msg.pug');
    let senderSocket = msg.sender_id?
        await getSocketByUserId(msg.sender_id) : null;
    let standardHTML = u({data: msg, own: false});

    if (senderSocket) {
        senderSocket.emit('message', u({data: msg, own: true}));
        senderSocket.broadcast.in('c:' + chatid).emit('message', standardHTML);
    } else
        io.in('c:' + chatid).emit('message', standardHTML);
    
}

cfx.chats.displayMessage = displayMessage;

io.on('connection', (socket) => {
    socket.on('join', j => {
        let userid = socket.request.session.user.id;
        if (userid) socket.join('u:' + userid);
        socket.join('c:' + j.chatid);
    });
    socket.on('message', r => {
        console.log(r);
    })
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});