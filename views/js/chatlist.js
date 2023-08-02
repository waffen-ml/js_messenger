document.querySelector('#add').addEventListener('click', () => {
    const username = document.querySelector('#userid').value;

    fetch(`/createchat?userid=${username}`)
    .then(r => r.json())
    .then(r => {
        if (!r.success) {
            alert('Ошибка!');
            return;
        }
        location.reload();
    })
})