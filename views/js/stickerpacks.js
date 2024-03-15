const stickerpackHolder = document.querySelector('.stickerpacks')


function openStickerpack(spack) {
    alert('hey')
}


fetch('/getallstickerpacks')
.then(r => r.json())
.then(spacks => {
    spacks.forEach(spack => {

        let element = templateManager.createElement('stickerpack', spack)

        stickerpackHolder.appendChild(element)

    })
})