class AvatarMaker {

    constructor(onAvatar) {
        this.onAvatar = onAvatar

        this.popup = new Popup({
            closable: true,
            html: templateManager.createHTML('load-avatar'),
            title: 'Загрузите аватар'
        })

        this.fileError = new ErrorBox(this.popup.window.querySelector('.hover-wrapper'), false)
        let uploadArea = this.popup.window.querySelector('.hover-area')
        
        makeUploadArea(uploadArea, (files) => {
            this.passFiles(files)
        }, 'Перенесите сюда изображение или нажмите', false, 'image/jpeg')
    }

    open() {
        this.popup.open()
    }

    _fileError(err) {
        this.fileError.setError(err)
    }

    passFiles(files) {
        if (files.length != 1) {
            this._fileError('Неверное количество файлов')
            return
        }
        else if (files[0].type != 'image/jpeg') {
            this._fileError('Необходим формат JPEG')
            return
        }
        let img = document.createElement('img')
        img.src = URL.createObjectURL(files[0])
    
        img.addEventListener('load', () => {
            if (img.height < 80 || img.width < 80) {
                this._fileError('Ширина и высота аватарки должны быть от 80 пикселей')
                return
            }
            this.cropImage(img.src)
        })
    }

    cropImage(imgSrc) {
        let cropPopup = new Popup({
            closable: false,
            title: 'Обрежьте аватар',
            html: templateManager.createHTML('crop-avatar')
        })
        cropPopup.addOption('Подтвердить', () => {
            fetch(output)
            .then(res => res.blob)
            .then(blob => this.onAvatar(blob, output))
            return true
        })
        cropPopup.addOption('Отмена', () => true)

        let output = null
        let original = cropPopup.window.querySelector('.original')
        let squareOutput = cropPopup.window.querySelector('.square')
        let roundOutput = cropPopup.window.querySelector('.round')

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
                output = src
            }

            setTimeout(() => {
                updateOutput()
            }, 25)
        }

        updateOutput()

        this.popup.replace(cropPopup)

    }    

}
