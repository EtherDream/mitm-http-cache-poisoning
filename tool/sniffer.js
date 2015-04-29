/**
 * HTTP 长缓存嗅探器 (2015/01/01)
 *
 * phantomjs sniffer.js option
 *
 * option:
 *    -u 测试单个 URL
 *    -i 测试列表
 *    -o 输出文件
 */
'use strict';

var UA = [
    // PC
    'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/33.0.1750.154 Safari/537.36'

    // Mobile
    //,'Mozilla/5.0 (iPhone; CPU iPhone OS 6_0 like Mac OS X) AppleWebKit/536.26 (KHTML, like Gecko) Version/6.0 Mobile/10A5376e Safari/8536.25'
];


var MAX_ITEM = 10,
    MAX_THREAD = 10,
    RES_TIMEOUT = 1000 * 10,
    PAGE_TIMEOUT = 1000 * 30,

    system = require('system'),
    webpage = require('webpage'),
    fs = require('fs'),

    mSiteResMap = {},
    mAnalyzedSet = {},
    mTotalNum = 0;



function loadList(path) {
    var text;
    try {
        text = fs.read(path).toString();
    } catch(e) {
        console.error('fail read ' + path);
        return;
    }

    var list = [];

    text.split('\n').forEach(function(line) {
        line = line.trim();
        if (!line || line[0] == '#') {
            return;
        }
        if (/^https:\/\//i.test(line)) {
            console.warn('https is not support:', line);
            return;
        }
        list.push(line);
    });
    return list;
}


function saveList(path) {
    var loop, result = {};

    // 按站点广度优先合并列表
    do {
        loop = false;

        for (var k in mSiteResMap) {
            var arr = mSiteResMap[k];
            var res = arr.pop();
            if (res) {
                result[res.url] = res.info;
                loop = true;
            }
        }
    } while (loop);

    // 存结果
    var data = JSON.stringify(result, null, 2);
    try {
        fs.write(path, data);
    }
    catch (e) {
        console.error('fail write ' + path);
    }
}



function ms2day(tick) {
    return Math.round(tick / (24 * 3600 * 1000));
}


function goPage(result, pageUrl, ua, callback) {
    var page = webpage.create();

    page.settings.userAgent = ua;
    page.settings.resourceTimeout = RES_TIMEOUT;

    page.onError = function() {};

    page.onResourceReceived = function(response) {

        // 只分析 http 资源
        var url = response.url;
        if (!/^http/i.test(url)) {
            return;
        }
        if (url in mAnalyzedSet) {
            return;
        }
        mAnalyzedSet[url] = true;

        // 只处理脚本文件
        // Y: .js | .js? | .js, | ...
        // N: .jsp
        if (/\.js($|\W)/i.test(url) == false) {
            return;
        }

        var charset = response.contentType.split('=')[1];
        var now, exp, modify, type, etag;

        response.headers.forEach(function(header) {
            switch (header.name.toLowerCase()) {
            case 'date':
                now = header.value;
                break;
            case 'expires':
                exp = header.value;
                break;
            case 'last-modified':
                modify = header.value;
                break;
            case 'etag':
                etag = header.value;
                break;
            }
        });

        // 过期时间
        exp = +new Date(exp);
        if (!exp) return;

        // 修改时间
        modify = +new Date(modify);
        if (!modify) return;

        // 当前时间
        now = +new Date(now);
        if (!now) now = Date.now();

        var dayStable = ms2day(now - modify);
        var dayCached = ms2day(exp - now);


        // 资源信息
        var info = {};
        if (dayCached > 0) {
            info.modify = new Date(modify).toGMTString();
        }
        if (etag) {
            info.etag = etag;
        }
        if (charset) {
            info.charset = charset;
        }

        // 保存记录
        result.push({
            url: url.split('//')[1],
            stable: Math.max(dayStable, 0),
            cache: Math.max(dayCached, 0),
            info: info
        });
    };

    // 访问测试页
    function done() {
        callback();
        page.close();
    }

    page.open(pageUrl, function() {
        clearTimeout(tid);
        done();
    });

    var tid = setTimeout(done, PAGE_TIMEOUT);
}


function goSite(url, callback) {

    var result = mSiteResMap[url];
    if (!result) {
        result = mSiteResMap[url] = [];
    }

    function onPageDone() {
        //
        // 按稳定程度排序，取最前的 MAX_ITEM 条记录
        //
        result.sort(function(a, b){return b.stable - a.stable});

        if (result.length > MAX_ITEM) {
            result.length = MAX_ITEM;
        }

        console.log(' * ' + url);

        if (result.length == 0) {
            console.log('  no result');
        }
        else {
            mTotalNum += result.length;
            result.forEach(function(res) {
                console.log('   -' + res.stable + '\t/ +' + res.cache + '\t\t' + res.url);
            });
        }
        console.log('');
        callback();
    }

    var n = 0;

    UA.forEach(function(ua) {
        goPage(result, url, ua, function() {
            if (++n == UA.length) {
                onPageDone();
            }
        });
    });
}


function usage() {
    console.log(
        'sniffer [options]\n' +
        '  -u, --url    测试单个 URL\n' +
        '  -i, --input  测试 URL 列表文件\n' +
        '  -o, --output 保存结果文件\n'
    );
}

function exit() {
    phantom.exit(0);
}

function main(args) {
    var inputFile, outputFile;
    var inputUrl;

    for (var i = 1; i < args.length; ++i) {
        switch(args[i]) {
        case '-i':
        case '--input':
            inputFile = args[++i];
            break;

        case '-o':
        case '--output':
            outputFile = args[++i];
            break;

        case '-u':
        case '--url':
            inputUrl = args[++i];
            if (!inputUrl) {
                console.error('invaild url');
                return exit();
            }
            break;

        case '-h':
        case '--help':
            usage();
            return exit();
        }
    }

    // 待测 URL 列表
    var list = [];

    if (inputUrl) {
        list.push(inputUrl);
    }
    else if (inputFile) {
        list = loadList(inputFile);
        if (!list) {
            return exit();
        }
    }
    else {
        usage();
        return exit();
    }

    var count = list.length;
    list = list.reverse();

    function nextTask() {
        var site = list.pop();
        if (site) {
            goSite(site, complete);
        }
    }

    function complete() {
        if (--count > 0) {
            return nextTask();
        }
        // 完成
        var sec = Math.round( (Date.now() - beginTime) / 1000 );
        console.log('DONE! Found ' + mTotalNum + ' results in ' + sec + ' sec');

        if (outputFile) {
            saveList(outputFile);
        }
        return exit();
    }

    // 开始测试
    var beginTime = Date.now();

    for (var i = 0; i < MAX_THREAD; i++) {
        setTimeout(nextTask, i * 1000);
    }
}

main(system.args);
