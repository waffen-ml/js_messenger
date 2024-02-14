const menuPopup = new Popup({
    closable: true,
    html: templateManager.createHTML('menu'),
    removeOnClose: false
})

function callMenu() {
    menuPopup.open()   
}
