# buyfull_wx_sdk

2018.9.8 V2版本
正式服 http://www.qieshu.net</br>
测试服 http://sandbox.qieshu.net</br>
测试请联系百蝠工作人员提供测试音频和设备</br>
此版本可以同时返回两个声波信道的检测结果以及每个声道的分贝数和总的分贝数（18-20Khz)</br></br>
detector.detect({</br>
      version: "v2", //针对qieshu.net上的帐号请使用v2</br>
      userID: "xxxxxxx" //可选，在后台报表数据中作为统计数据的一个参数</br>
    }, function (result) {</br>
      //result为对象，包括以下属性：</br></br>
       power 总的分贝数</br>
       allTags 所有信道的检测成功结果中的标签的集合</br>
       count 检测成功结果的数量</br>
       result  检测成功结果的集合</br>
       sortByPowerResult 按分贝数大小排序的信道信息，包含无效检测结果;</br>
       rawResult 原始信息信息，包含无效检测结果，从信道号0开始;</br></br>
       每个信道信息中包括</br>
        channel 信道编号</br>
        power 分贝数</br>
        tags 检测成功包含后台中设定的标签信息</br>
    }</br>



V1</br>
百蝠官网 http://www.buyfull.cc</br>
开发测试服 http://sandbox.buyfull.cc</br>

1. 准备</br>
  请和百蝠工作人员联系获取售前服务文档，并全部完成。如果只是想尝试一下SDK，可以跳过这一步。</br>
  基础库要求 最低1.6.0

  请将下列URL加入request 合法域名</br>
  https://api.buyfull.cc</br>
  https://cdn.buyfull.cc</br>
  https://cdnnorth.buyfull.cc</br>
  https://cdnnan.buyfull.cc</br>
  https://sandbox.buyfull.cc</br>
  sandbox.buyfull.cc为演示用后端域名，请自行布署并替换此域名,参考https://github.com/yecq/buyfull_wx_backend</br>

  请将下列URL加入uploadFile 合法域名</br>
  https://upload.qiniup.com</br>
  https://upload-z1.qiniup.com</br>
  https://upload-z2.qiniup.com</br>
  https://upload-na0.qiniup.com</br>
  https://upload-as0.qiniup.com</br>
  微信小程序合法域名设置请参考: http://www.jb51.net/article/93841.htm</br>
  设置完成后可以在微信开发工具主菜单->工具->项目详情->域名信息 中确认</br></br>
  
2. 集成SDK</br>
  参照index.js</br></br>
  onLoad：</br>
  detector.init({
      //这只是个demo,请联系百蝠获取appkey,同时布署自己的buyfull token service</br>
      appKey:"121e87d73077403eadd9ab4fec2d9973",//请替换成自己的APPKEY</br>
      buyfullTokenUrl:"https://sandbox.buyfull.cc/wx/buyfulltoken", //重要！！！此URL请替换成自已的服务器地址，这个地址上需要布署一个后台服务，用来返回buyfull token,参考https://github.com/yecq/buyfull_wx_backend</br>
      abortTimeout: 2000,//单次网络请求超时</br>
      detectTimeout: 6000,//单次检测的总超时</br>
      debugLog: true,//true可以打开debugLog</br>
      region: "ECN", //可选 ECN华东 NCN华北 SCN华南
    });</br></br>
    
    
3. 测试</br>
  测试音乐teststore1.mp3为纯高频音信标，teststore2.mp3为背景音乐信标。</br>
  请使用功放或小音箱或耳机或者苹果电脑输出，在电脑和手机上播放可能会出现杂音或识别距离下降。</br>
  请把mp3移到其它目录，否则会影响微信开发工具预览</br>
  测试时请使用手机调试小程序，在（苹果）电脑或是其它设备上播放MP3</br></br>

4. 注意事项和常见问题：</br>
  1）建议把BuyfullSDK做为整个APP生命周期中都存在的组件</br>
  2）detect返回的errorcode定义在buyfullsdk.js的开始。</br>
  3）请分清楚APPKEY和SECKEY是在正式服www.buyfull.cc申请的还是在测试服sandbox.buyfull.cc申请的。线下店帐号和APP帐号都要在同一平台上申请才能互相操作。</br>
  4）请确保网络通畅并且可以连接外网。</br>
  5）开发人员需要自行申请麦克风权限，参见index.js中的onclick。</br>
  6) 请注意开发的小程序的AppID要和百蝠后台中APP页面注册时填定的小程序ID保持一致，否则会出错误10或者13。</br>
  7) 请至少在APP帐号下购买一个渠道后再进行测试，否则会出错误10或者13。并且请在渠道中自行设定，自行设定，自行设定（重要的事情说三遍）识别结果，可以为任何字符串包括JSON。</br>
  8) detect中的参数option是预留的，目前为空。onDetect中返回的string是个URL地址，格式为</br>
     buyfull://detect?uuid=渠道的唯一标别码&mediaName=渠道名称&mediaInfo=您自行设定的识别结果</br>
     结果是经过标准的URL ENCODE的，解析前需要进行URL DECODE。</br>
  9）请经常更新buyfullsdk.js。</br>
  10）请记得把后台服务器的地址加入request 合法域名清单中</br>
  
有疑问请联系QQ:55489181

