let uploadBox = document.querySelector('#upload')

makeUploadArea(uploadBox, (files) => {
    console.log(files.length)
}, 'Перетащите сюда файлы или нажмите для обзора', true, 'image/jpeg')