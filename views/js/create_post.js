
loadForm((form) => {
    let unit = templateManager.createElement('post-body-editor')

    let textarea = unit.querySelector('textarea')

    unit.querySelector('.preview').addEventListener('click', () => {
        let popup = new Popup({
            html: templateManager.createHTML('post-body-preview', {body: textarea.value}),
            closable: true,
            className: 'post-body-preview'
        })

        popup.open()
    })

    form.setupCustomUnit('text', unit, (fd) => {
        fd.append('text', textarea.value)
    })
})