
document.querySelectorAll('[chatid]').forEach(chat => {
    chat.addEventListener('click', (e) => {
        if (e.target.classList.contains('dots'))
            return
        window.location = '/chat?id=' + chat.getAttribute('chatid')
    })
})

document.querySelectorAll('.dots').forEach(b => {
    b.addEventListener('click', e => {
        alert('hey')
    })
})