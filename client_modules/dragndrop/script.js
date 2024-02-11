
function makeUploadArea(area, onfiles, text, multiple, accept) {
    area.classList.add('upload-area')
    area.classList.add('block')

    let span = document.createElement('span')
    span.textContent = text
    area.appendChild(span)

    area.addEventListener('click', (e) => {
        e.preventDefault()
        let input = document.createElement('input');
        input.setAttribute('type', 'file');

        if (multiple)
            input.setAttribute('multiple', 1)

        if (accept)
            input.setAttribute('accept', accept)

        input.click();
        input.addEventListener('change', (e) => {
            const files = e.target.files;
            onfiles(files)
        })
    })

    area.addEventListener('dragleave', e => {
        e.preventDefault()
        e.stopPropagation()
        span.textContent = text
        area.classList.remove('active')
    })
    
    area.addEventListener('dragover', e => {
        e.stopPropagation()
        e.preventDefault()
        span.textContent = 'Отпустите'
        area.classList.add('active')
    })
    area.addEventListener('drop', e => {
        e.preventDefault()
        e.stopPropagation()
        area.classList.remove('active')
        span.textContent = text
        let files = e.dataTransfer.files;
        onfiles(files)
    })

}