const gameName = (new URLSearchParams(window.location.search)).get('name');
const mainForm = new Form('game-input', '/game-input?name=' + gameName, null);
mainForm.addSubmitButton('Готово', () => location.reload());
