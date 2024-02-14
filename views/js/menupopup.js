const menuPopup = new Popup({
    closable: true,
    className: 'menu',
    html: templateManager.createHTML('menu'),
    removeOnClose: false
})

function callMenu() {
    menuPopup.open()   
}
