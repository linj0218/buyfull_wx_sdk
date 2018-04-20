# buyfull_wx_sdk
百蝠官网 http://www.buyfull.cc</br>
开发测试服 http://sandbox.buyfull.cc</br>

1. 准备</br>
  请和百蝠工作人员联系获取售前服务文档，并全部完成。如果只是想尝试一下SDK，可以跳过这一步。</br>
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
  设置完成后可以在微信开发工具主菜单->工具->项目详情->域名信息 中确认</br>
2. 集成SDK</br>
  参照index.js</br></br>
  onLoad：</br>
  detector.init({
      //这只是个demo,请联系百蝠获取appkey,同时布署自己的buyfull token service</br>
      appKey:"121e87d73077403eadd9ab4fec2d9973",//请替换成自己的APPKEY</br>
      buyfullTokenUrl:"https://sandbox.buyfull.cc/wx/buyfulltoken", //此URL请替换成自已的服务器地址，这个地址上需要布署一个后台服务，用来返回buyfull token,参考https://github.com/yecq/buyfull_wx_backend</br>
      abortTimeout: 3000,//单次网络请求超时</br>
      detectTimeout: 5000,//单次检测的总超时</br>
      debugLog: true,//true可以打开debugLog</br>
    });</br></br>
    
    
3. 测试</br>
  测试音乐teststore1.mp3为纯高频音信标，teststore2.mp3为背景音乐信标。</br>
  请使用功放或小音箱或耳机或者苹果电脑输出，在电脑和手机上播放可能会出现杂音或识别距离下降。</br>
  请把mp3移到其它目录，否则会影响微信开发工具预览</br>
  测试时请使用手机调试小程序，在（苹果）电脑或是其它设备上播放MP3</br>

4. 注意事项和常见问题：</br>
  1）建议把BuyfullSDK做为整个APP生命周期中都存在的组件</br>
  2）detect返回的errorcode定义在buyfullsdk.js的开始。</br>
  3）请分清楚APPKEY和SECKEY是在正式服www.buyfull.cc申请的还是在测试服sandbox.buyfull.cc申请的。线下店帐号和APP帐号都要在同一平台上申请才能互相操作。</br>
  4）请确保网络通畅并且可以连接外网。</br>
  5）开发人员需要自行申请麦克风权限，参见index.js中的onclick。</br>
  6) 请查看一下AppDelegate和ViewController中的注释。</br>
  7) 请至少在APP帐号下购买一个渠道后再进行测试，并且请在渠道中自行设定，自行设定，自行设定（重要的事情说三遍）识别结果，可以为任何字符串包括JSON。</br>
  8) detect中的参数option是预留的，目前为空。onDetect中返回的string是个URL地址，格式为</br>
     buyfull://detect?uuid=渠道的唯一标别码&mediaName=渠道名称&mediaInfo=您自行设定的识别结果</br>
     结果是经过标准的URL ENCODE的，解析前需要进行URL DECODE。</br>
     
有疑问请联系QQ:55489181

