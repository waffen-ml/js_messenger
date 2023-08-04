const https = require('https');
const root = 'https://web-pipe.onrender.com/';

function getBackendResponse(data, onresponse) {
    const params = new URLSearchParams(data).toString();

    https.get(root + 'access?' + params, res => {
        let data = [];

        res.on('data', chunk => {
            data.push(chunk);
        });
    
        res.on('end', () => {
            data = JSON.parse(Buffer.concat(data).toString());
            onresponse(data);
        });
    });
}

exports.init = (cfx) => {
    cfx.chats.createChatbot(
        'Савелий', 'nn_saveliy', {
            'message': (msg, sendf) => {
                getBackendResponse({
                    text: msg.content.text
                },(r) => {
                    sendf(r.text);
                });
            }
        });
    
};