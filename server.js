var express = require('express');
var http = require('http');
var WebSocket = require('ws');
var crypto = require('crypto');
var fs = require('fs');
var images = require("images");

var app = express();
app.use(express.static(__dirname));

var server = http.createServer(app);
var wss = new WebSocket.Server({server});
var g_users = {};
fs.readFile('users.json', 'utf-8', (err, data) => {
    if (!err && data != undefined) {
        g_users = JSON.parse(data);
    }
});
var g_ranking = {};
fs.readFile('ranking.json', 'utf-8', (err, data) => {
    if (!err && data != undefined) {
        g_ranking = JSON.parse(data);
    }
});

var g_datas = {};
wss.on('connection', (ws) => {
    ws.on('message', (msg) => {
        var data = JSON.parse(msg);
        // console.log(data);
        switch(data.type){
            case 'ranking':
               ws.send(JSON.stringify({ type: 'ranking', data: g_ranking}));
                break;
            case 'countMsg':
                var date = new Date();
                date = date.getFullYear()+'/'+(parseInt(date.getMonth()) + 1) + '/' + date.getDate();
                if(!g_ranking[date]){
                    g_ranking[date] = {};
                }
                g_ranking[date][data.user] = {
                    msgs: data.msgs,
                    chars: data.chars,
                }
                fs.writeFile('ranking.json', JSON.stringify(g_ranking), (err) => {});
                break;
            case 'setProfile':
                var d = data.data;
                if(d.icon.indexOf('data:image') != 0){
                    d.icon = '';
                }
                g_users[d.name] = {
                    icon: d.icon,
                };
                fs.writeFile('users.json', JSON.stringify(g_users), (err) => {
                    if (err == null) {
                        if (!fs.existsSync("./icons/")) {
                            fs.mkdirSync("./icons/");
                        }
                        if(d.icon != ''){
                            var bin = new Buffer.from(d.icon.replace(/^data:image\/\w+;base64,/, ""), 'base64');
                            images(bin)
                            .resize(200)
                            .save('./icons/' + d.name + '.jpg', {
                                quality: 50
                            });
                        }else{
                             fs.writeFileSync('./icons/' + d.name + '.jpg', fs.readFileSync('user.jpg'));
                        }
                            
                        ws.send(JSON.stringify({ type: 'setProfile', data: d }));
                    }
                });
                break;
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
        var code = randNum(10000, 99999);
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
