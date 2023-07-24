const express = require('express');
const app = express();
const pug = require('pug');
const template = pug.compileFile('views/info.pug');
const builder = {
    data : {
        date: '03.03.2007',
        sender: {name: 'Ilya', id: 'ilya228'},
        content: {  
            text: 'hey how are you guys',
            image: ['https://c4.wallpaperflare.com/wallpaper/448/174/357/neon-4k-hd-best-for-desktop-wallpaper-preview.jpg'],
            video: ['https://v4.cdnpk.net/videvo_files/video/free/video0483/large_watermarked/_import_60d962f06b3ef8.86089157_FPpreview.mp4'],
            other: [],
            audio: []
        }
    },
    own : true
}


app.get('/', (req, res) => {
    res.send(template(builder));
});

app.listen(3000, () => {});