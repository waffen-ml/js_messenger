class AvatarMaker {

    cropImage(imgSrc) {
        openPopup({
            closable: false,
            html: getHidden('crop-avatar'),
            options: {
                'Подтвердить': (d) => {
                    fetch(d.output)
                    .then(res => res.blob())
                    .then(blob => this.onAvatar(blob))
                },
                'Отмена': () => {
    
                }
            },
            header: 'Обрежьте аватар',
            onload: (d) => {
                let original = d.obj.querySelector('.original')
                let squareOutput = d.obj.querySelector('.square')
                let roundOutput = d.obj.querySelector('.round')
    
                original.src = imgSrc
    
                const cropper = new Cropper(original, {
                    aspectRatio: 1,
                    viewMode: 3,
                    dragMode:'move',
                    wheelZoomRatio: 0.15,
                    minCropBoxWidth:50
                })

                function updateOutput() {
                    let canvas = cropper.getCroppedCanvas()

                    if (canvas) {
                        let src = canvas.toDataURL('image/jpeg')
                        squareOutput.src = src;
                        roundOutput.src = src;
                        d.output = src
                    }

                    setTimeout(() => {
                        updateOutput()
                    }, 25)
                }
    
                updateOutput()
            }
        })
    }    

    passFiles(files, err) {
        if (files.length != 1) {
            err.setError('Неверное количество файлов')
            return
        }
        else if (files[0].type != 'image/jpeg') {
            err.setError('Необходим формат JPEG')
            return
        }
        let img = document.createElement('img')
        img.src = URL.createObjectURL(files[0])
    
        img.addEventListener('load', () => {
            if (img.height < 80 || img.width < 80) {
                err.setError('Ширина и высота аватарки должны быть от 80 пикселей')
                return
            }
            this.cropImage(img.src)
        })
    }

    makeAvatar(onAvatar) {
        this.onAvatar = onAvatar

        openPopup({
            closable: true,
            html: getHidden('load-avatar'),
            options: {},
            header: 'Загрузите аватар',
            onload: (d) => {
                let errBox = new ErrorBox(d.obj.querySelector('.hover-wrapper'), false)
                let hoverArea = d.obj.querySelector('.hover-area')
                
                hoverArea.addEventListener('click', (e) => {
                    e.preventDefault()
                    let input = document.createElement('input');
                    input.setAttribute('type', 'file');
                    input.setAttribute('accept', 'image/jpeg')
                    input.click();
                    input.addEventListener('change', (e) => {
                        const files = e.target.files;
                        this.passFiles(files, errBox)
                    })
                })
    
                hoverArea.addEventListener('dragleave', e => {
                    e.preventDefault()
                    e.stopPropagation()
                    hoverArea.classList.remove('active')
                })
                
                hoverArea.addEventListener('dragover', e => {
                    e.stopPropagation()
                    e.preventDefault()
                    hoverArea.classList.add('active')
                })
                hoverArea.addEventListener('drop', e => {
                    e.preventDefault()
                    e.stopPropagation()
                    hoverArea.classList.remove('active')
                    let files = e.dataTransfer.files;
                    this.passFiles(files, errBox)
                })
            }
        })
    }


}

const avatarMaker = new AvatarMaker()