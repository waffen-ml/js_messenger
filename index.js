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

cfx.chats.createChat('Coffee chat')


function render(req, res, page, params) {
    console.log("RENDER " + req.sessionID);
    const user = cfx.as(req.session).user();

    res.render(page, {
        nav: {
            'Кофейный чат 🗨️': '/chat?id=0',
            'Сообщения': '/chatlist'
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

app.get('/createchat', (req, res) => {
    const user = login(req, res, true);
    const user2id = req.query.userid;
    const user2 = cfx.auth.getUser(user2id);

    if (!user || !user2 || user.id == user2id) {
        res.send({success: false});
        return;
    }

    const chatid = cfx.chats.createChat('', false);
    cfx.chats.addUserToChat(user.id, chatid, true, user2.name);
    cfx.chats.addUserToChat(user2.id, chatid, false, user.name);

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
    const chat = cfx.chats.getChat(req.query.id);
    const user = login(req, res, true);

    if (!user) return;
    else if (!chat.containsUser(user.id)) {
        res.redirect('/');
    }
    else 
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
    res.send({msgid : msgid});
});


async function getSocketByUserId(userid) {
    const sockets = await io.in('u:' + userid).fetchSockets();
    if (sockets.length < 1) return null;
    return sockets[0];
}

async function displayMessage(msg, chatid) {
    const u = pug.compileFile('msg.pug');
    const senderSocket = msg.sender? 
        await getSocketByUserId(msg.sender.id) : null;
    const standardHTML = u({data: msg, own: false});

    if (senderSocket) {
        senderSocket.emit('message', u({data: msg, own: true}));
        senderSocket.broadcast.in('c:' + chatid).emit('message', standardHTML);
    } else
        io.in('c:' + chatid).emit('message', standardHTML);
    
}

cfx.chats.displayMessage = displayMessage;

io.on('connection', (socket) => {
    socket.on('join', j => {
        const userid = socket.request.session.userid;
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