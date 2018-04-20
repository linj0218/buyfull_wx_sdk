# buyfull_wx_sdk
百蝠官网 http://www.buyfull.cc</br>
开发测试服 http://sandbox.buyfull.cc</br>

1. 准备</br>
  请和百蝠工作人员联系获取售前服务文档，并全部完成。如果只是想尝试一下SDK，可以跳过这一步。
  基础库要求 最低1.6.0

  请将下列URL加入request 合法域名</br>
  https://api.buyfull.cc</br>
  https://cdn.buyfull.cc</br>
  https://sandbox.buyfull.cc</br>
  sandbox.buyfull.cc为演示用后端域名，请自行布署并替换此域名,参考https://github.com/yecq/buyfull_wx_backend</br>

  请将下列URL加入uploadFile 合法域名</br>
  https://up.qbox.me</br>
  https://up-z1.qbox.me</br>
  https://up-z2.qbox.me</br>
  https://up-na0.qbox.me</br>
  微信小程序合法域名设置请参考: http://www.jb51.net/article/93841.htm</br>
  设置完成后可以在微信开发工具主菜单->工具->项目详情->域名信息 中确认
2. 集成SDK</br>
  参照index.js onLoad：</br>
  detector.init({
      //这只是个demo,请联系百蝠获取appkey,同时布署自己的buyfull token service
      appKey:"121e87d73077403eadd9ab4fec2d9973",//demo appkey
      buyfullTokenUrl:"https://sandbox.buyfull.cc/wx/buyfulltoken", //此
      abortTimeout: 3000,//单次网络请求超时
      detectTimeout: 5000,//单次检测的总超时
      debugLog: true,//true可以打开debugLog
    });
    
3. 测试</br>
  测试音乐teststore1.mp3为纯高频音信标，teststore2.mp3为背景音乐信标。
  请使用功放或小音箱或耳机或者苹果电脑输出，在电脑和手机上播放可能会出现杂音或识别距离下降。
  请把mp3移到其它目录，否则会影响微信开发工具预览
  测试时请使用手机调试小程序，在（苹果）电脑或是其它设备上播放MP3

有疑问请联系QQ:55489181

