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
    constructor(name, startScene, scenes) {
        this.name = name;

        this.scenes = {};
        (scenes ?? []).forEach(scene => 
            this.scenes[scene.name] = scene);

        this.startScene = startScene;
        this.players = {};
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
        return new RenderData(this.name, 
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
    constructor() {
        this.games = {};
    }
    
    addGame(game) {
        this.games[game.name] = game;
    }

    getGame(name) {
        return this.games[name];
    }

    render(game, id) {
        return this.getGame(game).render(id);
    }

    input(game, id, data) {
        return this.getGame(game).input(id, data);
    }

    init(cfx) {

    }
}

let Form = require('./forms').Form;
exports.SceneCall = SceneCall;
exports.Scene = Scene;
exports.Game = Game;

exports.init = (cfx) => {
    if(!cfx.forms)
        return true;

    let gameCenter = new GameCenter();
    gameCenter.init(cfx);

    let game = new Game('one', 'first');

    game.addScene(new Scene('first', 'index',
        [{type: 'text', name:'msg', placeholder: 'хуй'}],
        {
            run: (player, params) => {
                params ??= {};
                player.count = (player.count ?? 0) + 1;
                let message = params.text + ' ' + player.count;
                return {msg: message};
            },

            val: (data, erf) => {
            },

            ok: (data, player, params) => {
                return new SceneCall(null, {text: data.msg})
            }
        }
    ));


    gameCenter.addGame(game);

    cfx.core.app.get('/game', (req, res) => {
        let user = cfx.core.login(req, res, true);
        let game = gameCenter.getGame(req.query.name);
        let renderData = game.render(user.id);
        let path = `./games/${renderData.game}/view/${renderData.template}.pug`; 
        let content = cfx.core.pug.renderFile(path, renderData.data);
        cfx.core.render(req, res, 'game', {_form: renderData.form, _content: content});
    })

    cfx.core.app.post('/game-input', cfx.core.upload.none(), (req, res) => {
        let user = cfx.core.login(req, res, true);
        let game = gameCenter.getGame(req.query.name);
        let output = game.input(user.id, req.body);
        res.send(output ?? {'_out': true});
    })


}