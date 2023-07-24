// engine
const cfx = require('./cfx-main').cfx;

const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const pug = require('pug');
const server = require('http').createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const session = require('express-session');
const store = new session.MemoryStore();
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
app.use(session({
    secret: 'coffee tox',
    cookie: {maxAge: 1000 * 60 * 60},
    saveUninitialized: false,
    resave: false,
    store
}));

cfx.chats.createChat('Coffee chat')


function render(req, res, page, params) {
    console.log("RENDER " + req.sessionID);
    const user = cfx.as(req.session).user();

    res.render(page, {
        nav: {
            'Кофейный чат 🗨️': '/chat?id=0',
            'Новости': '/feed',
            'Сообщения': '/messenger',
            'Моя страница': '/profile',
            'Друзья': '/friends',
            'Мини-приложения': '/miniapps'
        },
        user: user,
        ...params
    });
}

function login(req, res, requireLogin) {
    const userid = req.session.userid;
    const user = cfx.auth.getUser(userid);
    if (!user && requireLogin) res.redirect('/login');
    return user;
}

app.get('/', (req, res) => {
    render(req, res, 'index');
});

app.get('/chat', (req, res) => {
    const chat = cfx.chats.getChat(req.query.id);
    const user = login(req, res, true);
    if (!user) return;

    render(req, res, 'chat', {
        observer: user,
        chat: chat
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

    const out = cfx.forms.passData(req.query.name, data, cfx.as(req.session));

    if (out._out === undefined)
        req.files.forEach(f => fs.unlink(f.path, () => {}));

    res.json(out);
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
    const chatid = req.query.id;
    const chat = cfx.chats.getChat(chatid);
    const sender = login(req, res, true);

    if (!sender || !chat) return;

    const msg = {
        sender: sender,
        system: false,
        content: cfx.utils.createContent(req.body.text, req.files)
    };

    const msgid = chat.addMessage(msg);

    res.json({msgid: msgid});
});

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('join', j => {
        socket.join(j.id);
    });

    socket.on('message', r => {
        const u = pug.compileFile('msg.pug');
        const chat = cfx.chats.getChat(r.chatid);
        const msg = chat.getMessage(r.msgid);

        const toSender = u({data: msg, own: true});
        const toOthers = u({data: msg, own: false});

        socket.send(toSender);
        socket.broadcast.emit('message', toOthers);
    });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});