
class Socket {
    constructor(cfx) {
        this.cfx = cfx
        this.io = cfx.core.io
        this.listeners = []
        
        this.io.on('connection', socket => {
            let userid = socket.request.session.userid

            if (userid)
                socket.join('u:' + userid)
            
            this.listeners.forEach(l => l(socket, userid))
        })

    }

    onSocket(f) {
        this.listeners.push(f)
    }

    getSocketsInRoom(room) {
        return this.io.in(room).fetchSockets()
    }

    getSocketByUserId(userid) {
        return this.getSocketsInRoom('u:' + userid)
        .then(sockets => {
            return sockets.length? sockets[0] : null
        })
    }

    forEverySocketInRoom(room, f) {
        this.getSocketsInRoom(room)
        .then((sockets) => {
            sockets.forEach(socket => f(socket))
        })
    }

}


exports.init = (cfx) => {
    cfx.socket = new Socket(cfx)
}