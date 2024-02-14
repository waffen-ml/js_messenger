const menuPopup = new Popup({
    closable: true,
    html: templateManager.createHTML('menu'),
    removeOnClose: false
})

function callPopup() {
    menuPopup.open()   
}
