const chatid = new URLSearchParams(window.location.search).get('id');
const holder = document.querySelector('.holder');
const input = document.querySelector('.entry');
const socket = io();
let attachedFiles = [];

function scrollDown() {
    holder.scrollTo({top: holder.scrollHeight, behavior: 'smooth'});
}

function send() {
    if (input.value == '' && !attachedFiles.length) return;

    let data = new FormData();
    data.append('text', input.value);
    
    attachedFiles.forEach(f => data.append('files', f));

    fetch('/sendmsg?id=' + chatid, {
        method: 'POST',
        credentials: 'same-origin',
        body: data
    }).then(r => r.json())
    .then(r => {
        console.log(r);
    })

    input.value = '';
    attachedFiles = [];
    updateFileCount();
}

function updateFileCount() {
    const btn = document.querySelector('.input-bar #file');
    const count = attachedFiles.length;
    btn.value = (count? count + ' ' : '') + '📁';
}

function openFilePopup() {
    openPopup({
        header: 'Файлы',
        html: '',
        onload: (p) => {
            p.uploader = uplManager.createUploader({
                files: attachedFiles,
                onInspect: (file) => inspectFile(file, {
                    options: { 'Назад': openFilePopup }
                })
            });
            p.obj.appendChild(p.uploader.element);
        },
        ondestroy: (p) => {
            attachedFiles = p.uploader.files;
            updateFileCount();
        },
        options: {
            'Ок': null
        }
    });
    return true;
}

document.querySelector('#send').onclick = send;
document.querySelector('#file').onclick = openFilePopup;

input.addEventListener('keydown', (e) => {
    if (e.key != 'Enter') return;
    e.preventDefault();
    send();
})

socket.emit('join', {chatid: chatid});

socket.on('message', html => {
    const div = document.createElement('div');
    div.innerHTML = html;
    setupInspectObjects(div);
    [...div.children].forEach(child => holder.appendChild(child));
    scrollDown();
});


scrollDown();