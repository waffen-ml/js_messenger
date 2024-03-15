const stickerpackHolder = document.querySelector('.stickerpacks')


function openStickerpack(spack) {
    let popup = new Popup({
        html: '<div class="stickers styled-scroll"></div>',
        className: 'inspect-stickerpack',
        closable: true
    })

    if (!spack.available) {
        popup.addOption(`Купить (${spack.price} EBL)`, () => {
            alert('buy!')
        })
    }

    let stickerHolder = popup.querySelector('.stickers')

    for(let i = 0; i < spack.count; i++)
        stickerHolder.innerHTML += `<img class="sticker" src="/public/stickers/${spack.tag}/${i}.png">`

    popup.open()
}


fetch('/getallstickerpacks')
.then(r => r.json())
.then(spacks => {
    spacks.forEach(spack => {
        let element = templateManager.createElement('stickerpack', spack)
        element.addEventListener('click', () => openStickerpack(spack))
        stickerpackHolder.appendChild(element)
    })
})