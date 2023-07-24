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
    })
    .then((r) => r.json())
    .then((r) => {
        console.log(r);
        socket.send({
            msgid: r.msgid,
            chatid: chatid
        });
    });

    input.value = '';
    attachedFiles = [];
    updateFileCount();
}

function detachFile(obj, i) {
    attachedFiles.splice(i, 1);
    updateFileList(obj);
}

function updateFileCount() {
    const btn = document.querySelector('.input-bar #file');
    const count = attachedFiles.length;
    btn.value = (count? count + ' ' : '') + '📁';
}

function updateFileList(obj) {
    obj.innerHTML = '';
    attachedFiles.forEach((file, i) => {
        const li = document.createElement('li');
        const filebtn = document.createElement('a');
        filebtn.setAttribute('class', 'clean finite file');
        filebtn.textContent = file.name;
        filebtn.onclick = () => {
            const blobData = new Blob([file], { type: file.type });
            const blobUrl = URL.createObjectURL(blobData);
            window.open(blobUrl, '_blank');
        }
        
        const removebtn = document.createElement('a');
        removebtn.setAttribute('class', 'remove button');
        removebtn.textContent = '🗑️';
        removebtn.onclick = () => detachFile(obj, i);
        
        li.appendChild(removebtn);
        li.appendChild(filebtn);

        obj.appendChild(li);
    });
    if (!obj.innerHTML)
        obj.innerHTML = '<li>Нет прикрепленных файлов 🚫</li>';
    updateFileCount();
}

function attachFiles(obj) {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('multiple', true);
    input.click();
    input.addEventListener('change', (e) => {
        const files = e.target.files;
        attachedFiles.push(...files);
        updateFileList(obj);
    });
}

document.querySelector('#send').onclick = send;
document.querySelector('#file').onclick = () => {
    openPopup({
        header: 'Файлы',
        html: getHidden('files'),
        onload: (p) => {
            p.list = p.obj.querySelector('.attached');
            updateFileList(p.list);
            p.obj.querySelector('.attach').onclick = () => attachFiles(p.list);
        },
        options: {
            'Ок': null
        }
    });
};  

input.addEventListener('keydown', (e) => {
    if (e.key != 'Enter') return;
    e.preventDefault();
    send();
})

socket.emit('join', {id: chatid});

socket.on('message', html => {
    const div = document.createElement('div');
    div.innerHTML = html;
    setupInspectObjects(div);
    [...div.children].forEach(child => holder.appendChild(child));
    scrollDown();
});


scrollDown();