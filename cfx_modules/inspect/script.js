function constructMediaHTML(media) {
    switch(media.type) {
        case 'image':
            return `<img class="media" src="${media.src}" alt="inspect-img">`;
        case 'video':
            return `<video class="media" controls><source src="${media.src}"></video>`;
        default:
            return '';
    }
}

function _getSrc(obj, tag) {
    if (obj.tagName == tag)
        return obj.src;
    const inner = obj.querySelector(tag);
    return inner? inner.src : null;
}

function getElementMedia(obj) {
    const imgSrc = _getSrc(obj, 'IMG');
    if (imgSrc) return {type: 'image', src: imgSrc};
    const vidSrc = _getSrc(obj, 'VIDEO');
    if (vidSrc) return {type: 'video', src: vidSrc};
    return {};
}

function inspectMedia(data) {
    openPopup({
        closable: true,
        html: getHidden('h-inspect'),
        onload: (d) => {
            const inspect = d.obj.querySelector('.inspect');
            inspect.innerHTML += constructMediaHTML(data);

            const lb = d.obj.querySelector('.left');
            const rb = d.obj.querySelector('.right');
            
            rb.onclick = data.next;
            lb.onclick = data.prev;

            if (data.next) inspect.classList.add('next');
            if (data.prev) inspect.classList.add('prev');
        }
    });
}

function getGroupElement(groupid, index) {
    return document.querySelector(`[inspect-parent="${groupid}"][inspect-index="${index}"]`);
}

function createTransFunc(groupid, index) {
    if(!getGroupElement(groupid, index)) return null;
    return () => inspectGroup(groupid, index);
}

function inspectSingle(obj) {
    inspectMedia(getElementMedia(obj));
}

function inspectGroup(groupid, index) {
    const obj = getGroupElement(groupid, index);

    inspectMedia({
        next: createTransFunc(groupid, index + 1),
        prev: createTransFunc(groupid, index - 1),
        ...getElementMedia(obj)
    });
}

let i = 0;

function setupInspectObjects(container) {
    console.log('setting up insp. objects...');

    container.querySelectorAll('[inspect]').forEach(obj => {
        obj.addEventListener('click', () => inspectSingle(obj));
        obj.setAttribute('inspect', 1);
    });
    
    container.querySelectorAll('[inspect-group]').forEach(group => {
        const gid = i++;
        group.setAttribute('inspect-group', gid);
        [...group.children].forEach((child, j) => {
            child.setAttribute('inspect-parent', gid);
            child.setAttribute('inspect-index', j);
            child.addEventListener('click', () => inspectGroup(gid, j));
        });
    });
}

setupInspectObjects(document);