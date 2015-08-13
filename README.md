## Install

```
npm install
```

## Run

```
node index.js
```

## Test

浏览器代理 HTTP -> 127.0.0.1:8080

访问任意 HTTP 页面即可触发。

关闭代理。打开 http://www.163.com 若弹出对话框，感染成功。


## 更新缓存列表

进入 tool 文件夹，执行 ``run.cmd``。需安装 [phantomjs](http://phantomjs.org/)

该脚本会访问 ``url.txt`` 中的网站列表，分析出易感染的脚本文件，同时保存。
