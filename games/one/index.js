

exports.init = (Game, Scene, SceneCall) => {
    let game = new Game('one', 'hey', 'first');

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

    return game;
}