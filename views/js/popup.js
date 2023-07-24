const popup = document.querySelector('.popup');
const popupWindow = popup.querySelector('.window');
const inner = popupWindow.querySelector('.inner');
const animlength = 300;
let popupMeta = null;

function isPopupActive() {
    return popupMeta !== null;
}

function setAnim(obj, anim) {
    obj.style.animation = `${anim} ${animlength}ms ease-in-out forwards`;
}

function togglePointerEvents(state, obj) {
    obj ??= popup;
    obj.style.pointerEvents = state? 'all' : 'none';
}

function animTimeout(cb) {
    setTimeout(cb, animlength);
}

function hidePopup() {
    togglePointerEvents(false);

    setAnim(popup, 'disappear');
    setAnim(popupWindow, 'close-window');

    animTimeout(() => {
        popup.style.display = 'none';
    })
}

function showPopup() {
    togglePointerEvents(false);
    popup.style.display = 'flex';

    setAnim(popup, 'appear');
    setAnim(popupWindow, 'open-window');

    animTimeout(() => {
        togglePointerEvents(true);
    })
}

function setWindowContent(content) {
    popupWindow.querySelector('.content').innerHTML = content;
}

function setWindowHeader(text) {
    const header = popupWindow.querySelector('.header');
    header.style.display = text? 'block' : 'none';
    header.textContent = text;
}

function toggleCloseButton(state) {
    const cbtn = popupWindow.querySelector('.close-btn');
    cbtn.style.display = state? 'block' : 'none';
}

function setWindowOptions(options) {
    const holder = popupWindow.querySelector('.buttons');
    holder.innerHTML = '';

    const keys = options? Object.keys(options) : [];

    holder.style.display = keys.length? 'flex' : 'none';

    keys.forEach((key) => {
        let btn = document.createElement('input');
        btn.type = 'button';
        btn.value = key;
        btn.addEventListener('click', () => {
            if (!options[key] || !options[key](popupMeta.data))
                closePopup();
        });
        holder.insertBefore(btn, holder.firstChild);
    });
}

function setupPopup(data) {
    data.closable ??= true;
    
    setWindowHeader(data.header);
    setWindowContent(data.html);
    setWindowOptions(data.options);
    toggleCloseButton(data.closable);

    data.data = { obj: getPopupContent() };

    if (data.onload)
        data.onload(data.data);

    popupMeta = data;
}

function openPopup(data) {
    if (!isPopupActive())
        showPopup();
    setupPopup(data);
}

function closePopup() {
    popupMeta = null;
    hidePopup();
}

function getHidden(id) {
    id = id? '#' + id: '';
    return document.querySelector('hidden' + id).innerHTML;
}

function getPopupContent() {
    return popupWindow.querySelector('.content');
}
 
popup.addEventListener('click', (e) => {
    if (isPopupActive() && popupMeta.closable && e.target == popup)
        closePopup();
});

popupWindow.querySelector('.close-btn').addEventListener('click', (e) => {
    if(isPopupActive()) closePopup();
});

/*
openPopup({
    closable: true,
    header: 'my first page',
    html: '<h1>hey!</h1>',
    options: {
        'next': () => {
            openPopup({
                header: 'my second page',
                html: '<h1>hey!</h1><h1>hey!</h1><h1>hey!</h1><h1>hey!</h1><h1>hey!</h1>'
            })
            return true;
        }
    }
});*/