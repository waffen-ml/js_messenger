const stickerpackHolder = document.querySelector('.stickerpacks')


function openStickerpack(spack) {
    let popup = new Popup({
        html: '<div class="stickers styled-scroll"></div>',
        className: 'inspect-stickerpack',
        closable: true
    })

    if (!spack.available) {
        popup.addOption(`Купить (${spack.price} EBL)`, () => {
            fetch('/buystickerpack?id=' + spack.id)
            .then(r => r.json())
            .then(r => {
                if(!r.success) {
                    alert('Ошибка: ' + r.error)
                    return
                }
                alert('Успех!')
                popup.close()
                updateStickerpacks()
            })
        })
    }

    let stickerHolder = popup.querySelector('.stickers')

    for(let i = 0; i < spack.count; i++)
        stickerHolder.innerHTML += `<img class="sticker" src="/public/stickers/${spack.tag}/${i}.png">`

    popup.open()
}

function updateStickerpacks() {
    fetch('/getallstickerpacks')
    .then(r => r.json())
    .then(spacks => {
        stickerpackHolder.innerHTML = ''
        spacks.forEach(spack => {
            let element = templateManager.createElement('stickerpack', spack)
            element.addEventListener('click', () => openStickerpack(spack))
            stickerpackHolder.appendChild(element)
        })
    })
}
