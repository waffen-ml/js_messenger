
loadForm((form) => {
    let unit = document.querySelector('hidden .html-editor');
    let editorElement = unit.querySelector('#editor');
    let editor = ace.edit(editorElement);
    editor.session.setUseWorker(false);
    editor.setOptions({
        fontSize: "13pt"
    });
    editor.setTheme("ace/theme/github_dark");
    editor.getSession().setMode("ace/mode/html");

    unit.querySelector('.preview').addEventListener('click', () => {
        openPopup({
            closable: true,
            html: '<iframe id="preview"></iframe>',
            options: {'OK': () => {}},
            onload: (d) => {
                const iframe = d.obj.querySelector('#preview');
                iframe.srcdoc = editor.getValue()
            }
        });
    })

    form.setupCustomUnit('html', unit, (fd) => {
        fd.append('html', editor.getValue());
    });
})