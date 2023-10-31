
document.querySelectorAll('.game-tile').forEach(game => {
    game.addEventListener('click', () => {
        window.location.replace('/game?id=' + game.getAttribute('gameid'))
    })
})