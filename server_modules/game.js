class SceneCall {
    constructor(name, params) {
        this.name = name;
        this.params = params;
    }
}

class RenderData {
    constructor(game, template, data, form) {
        this.game = game;
        this.template = template;
        this.data = data;
        this.form = form;
    }
}

class Scene {
    constructor(name, template, formUnits, f) {
        this.name = name;
        this.template = template ?? name;
        this.onRun = f.run;
        this.form = new Form(null, formUnits, f.val, f.ok);
    }

    run(player, params) {
        let renderData = this.onRun(player.data, params);
        player.scene = this;
        player.params = params;
        player.render = renderData;
    }

    input(player, data) {
        return this.form.passData(data, player.data, player.params);
    }
}

class Player {
    constructor(id) {
        this.id = id;
        this.scene = null;
        this.data = {};
    }
}

class Game {
    constructor(title, descr, startScene, scenes) {
        this.title = title;
        this.descr = descr;
        this.id = null;

        this.scenes = {};
        (scenes ?? []).forEach(scene => 
            this.scenes[scene.name] = scene);

        this.startScene = startScene;
        this.players = {};
    }

    setId(id) {
        this.id = id;
    }

    addScene(scene) {
        this.scenes[scene.name] = scene;
    }

    getPlayer(id) {
        if (!this.players[id]) {
            let player = new Player(id);
            this.getScene(this.startScene).run(player);
            this.players[id] = player;
        }
        return this.players[id];
    }

    getScene(name) {
        return this.scenes[name];
    }

    render(id) {
        let player = this.getPlayer(id);
        return new RenderData(this.id, 
            player.scene.template, player.render,
            player.scene.form);
    }

    input(id, data) {
        let player = this.getPlayer(id);
        let output = player.scene.input(player, data);

        if (!('_out' in output))
            return output;
        
        else if (output['_out']) {
            let call = output['_out'];
            let newScene = this.getScene(call.name ?? player.scene.name);
            newScene.run(player, call.params);
        }
    }
}

class GameCenter {
    constructor(exports) {
        this.games = {};
        this.exports = exports;
    }
    
    addGame(game) {
        this.games[game.id] = game;
    }

    getGame(id) {
        return this.games[id];
    }

    render(gameid, playerid) {
        return this.getGame(gameid).render(playerid);
    }

    input(gameid, playerid, data) {
        return this.getGame(gameid).input(playerid, data);
    }

    init(cfx) {
        let folders = [];

        try {
            folders = cfx.core.fs.readdirSync('./games');
        } catch(ex) {
            console.log('Unable to load any games!');
        }

        folders.forEach(folder => {
            if (folder.includes('.'))
                return;
            try {
                let gameModule = require('../games/' + folder + '/index');
                let game = gameModule.init(...this.exports);
                game.setId(folder);
                this.addGame(game);
            } catch(ex) {
                throw ex;
            }
        });
        
    }
}

let Form = require('./forms').Form;
exports.SceneCall = SceneCall;
exports.Scene = Scene;
exports.Game = Game;

exports.init = (cfx) => {
    if(!cfx.forms || !cfx.files)
        return true;

    let gameCenter = new GameCenter([Game, Scene, SceneCall]);
    gameCenter.init(cfx);

    cfx.core.app.get('/game', (req, res) => {
        let user = cfx.core.login(req, res, true);
        let game = gameCenter.getGame(req.query.id);
        let renderData = game.render(user.id);
        let path = `./games/${renderData.game}/view/${renderData.template}.pug`; 
        let content = cfx.core.pug.renderFile(path, renderData.data);
        cfx.core.render(req, res, 'game', {_form: renderData.form, _content: content});
    })

    cfx.core.app.post('/game-input', cfx.core.upload.none(), (req, res) => {
        let user = cfx.core.login(req, res, true);
        let game = gameCenter.getGame(req.query.id);
        let output = game.input(user.id, req.body);
        res.send(output ?? {'_out': true});
    })

    cfx.core.app.get('/gamelist', (req, res) => {
        cfx.core.render(req, res, 'gamelist', {games: gameCenter.games});
    })


}