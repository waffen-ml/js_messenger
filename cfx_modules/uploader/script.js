function attachFiles(cb, single) {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    if (!single) input.setAttribute('multiple', 1);
    input.click();
    input.addEventListener('change', (e) => {
        const files = e.target.files;
        cb([...files]);
    });
}

function inspectFile(file) {
    const type = file.type.split('/')[0];

    if (['image', 'video'].includes(type)) {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            inspectMedia({
                type: type,
                src: reader.result
            })
        });
        reader.readAsDataURL(file);
        return;
    }

    const blobData = new Blob([file], { type: file.type });
    const blobUrl = URL.createObjectURL(blobData);
    window.open(blobUrl, '_blank');
}


function preventDefault(e) {
    e.preventDefault();
    e.stopPropagation();
}


class Uploader {
    constructor(element, files) {
        this.element = element;

        element.setAttribute('class', 'block uploader');
        element.innerHTML = getHidden('uploader');

        this.list = element.querySelector('ul');
        this.files = files ?? [];
        
        let limit = element.getAttribute('limit') ?? 10;
        this.limit = parseInt(limit);
        if(this.limit == 1) this.element.classList.add('single');

        element.addEventListener('dragleave', e => {
            preventDefault(e);
            this.toggleHighlight(false);
        })
        
        element.addEventListener('dragover', e => {
            preventDefault(e);
            this.toggleHighlight(true);
        })
        
        element.addEventListener('drop', e => {
            preventDefault(e);
            const files = e.dataTransfer.files;
            this.addFiles([...files]);
            this.toggleHighlight(false);
        })
        
        element.querySelector('.attach').onclick = () =>
            attachFiles(files => {
                this.addFiles(files);
            });
        
        this.update();
    }

    toggleClass(classname, state) {
        if (state)
            this.element.classList.add(classname);
        else
            this.element.classList.remove(classname);
    }

    toggleHighlight(state) {
        this.toggleClass('drag', state);
    }

    toggleDisabled(state) {
        this.toggleClass('disabled', state);
    }

    removeFile(i) {
        this.files.splice(i, 1);
        this.update();
    }

    isLimitReached() {
        return this.limit <= this.files.length;
    }

    update() {
        this.list.innerHTML = '';
    
        this.files.forEach((file, i) => {
            const li = document.createElement('li');
    
            const filebtn = document.createElement('a');
            filebtn.setAttribute('class', 'clean finite file');
            filebtn.textContent = file.name;
            filebtn.onclick = () => inspectFile(file);
            
            const removebtn = document.createElement('a');
            removebtn.setAttribute('class', 'remove button');
            removebtn.textContent = '🗑️';
            removebtn.onclick = () => this.removeFile(i);
            
            li.appendChild(removebtn);
            li.appendChild(filebtn);
    
            this.list.appendChild(li);
        });
    
        if (!this.list.innerHTML)
            this.list.innerHTML = '<li>Нет прикрепленных файлов 🚫</li>';
        
        this.toggleDisabled(this.isLimitReached());
    }

    addFiles(arr) {
        let c = Math.min(this.limit - this.files.length, arr.length);
        this.files.push(...arr.slice(0, c));
        this.update();
    }
}


const uplManager = new class {
    uploaders = {};
    i = 0;

    getUploader(id) {
        return this.uploaders[id];
    }

    setupContainer(container) {
        container.querySelectorAll('.uploader').forEach(obj => {
            const id = obj.getAttribute('id') ?? ('upl' + (this.i++));
            obj.setAttribute('id', id);
            const upl = new Uploader(obj);
            this.uploaders[id] = upl;
        });
    }

    createUploader(data, files) {
        const div = document.createElement('div');
        if (data.limit) div.setAttribute('limit', data.limit);
        return new Uploader(div, files);
    }
}

uplManager.setupContainer(document);    
