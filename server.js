var express = require('express');
var http = require('http');
var WebSocket = require('ws');
var crypto = require('crypto');

var app = express();
app.use(express.static(__dirname));

var server = http.createServer(app);
var wss = new WebSocket.Server({server});

var g_datas = {};
wss.on('connection', (ws) => {
    ws.on('message', (msg) => {
        var data = JSON.parse(msg);
        // console.log(data);
        switch(data.type){
            case 'uploadData':
                var md5 = crypto.createHash('md5').update(JSON.stringify(data.data)).digest("hex");
                if(md5 != data.md5){
                    return ws.send(JSON.stringify({type: 'uploadData'}));
                }
                for(var key in g_datas){
                    if(g_datas[key].md5 == md5){
                        return ws.send(JSON.stringify({type: 'uploadData', code: key}));
                    }
                }

                var code = getRandNum();
                g_datas[code] = {
                    md5: md5,
                    data: data.data,
                    timer: setTimeout(() => {
                        delete g_datas[code];
                    }, 1000 * 60 * 10)
                }
                ws.send(JSON.stringify({type: 'uploadData', code: code}));
                break;

            case 'sync':
                if(g_datas[data.code]){
                    var d = g_datas[data.code];
                    delete g_datas[data.code];
                    clearTimeout(d.timer);
                    ws.send(JSON.stringify({type: 'sync', data: d.data, md5: d.md5}));
                }else{
                    ws.send(JSON.stringify({type: 'sync'}));
                }
                break;
        }
    });
});

function getRandNum(){
    while(1){
        var code = randNum(1, 100);
        if(g_datas[code] == undefined){
            return code;
        }
    }
}

function randNum(min, max) {
    return parseInt(Math.random() * (max - min + 1) + min, 10);
}

server.listen(8000, function listening() {
    console.log('服务器启动成功！');
});