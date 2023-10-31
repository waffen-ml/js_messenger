const gameId = (new URLSearchParams(window.location.search)).get('id');
const mainForm = new Form('game-input', '/game-input?id=' + gameId, null);
mainForm.addSubmitButton('Готово', () => location.reload());
