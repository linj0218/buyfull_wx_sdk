//index.js
//获取应用实例
const detector = require("../../utils/buyfullsdk");


var app = getApp()
Page({
  onLoad: function () {
    detector.init({
      //这只是个demo,请联系百蝠获取appkey,同时布署自己的buyfull token service
      appKey:"121e87d73077403eadd9ab4fec2d9973",
      buyfullTokenUrl:"https://sandbox.buyfull.cc/wx/buyfulltoken",
      abortTimeout: 3000,//单次网络请求超时
      detectTimeout: 5000,//总超时
    });
  },
  
  onclick: function () {
    detector.detect(null, function(resultUrl){
      console.log("检测成功,url是:" + resultUrl);
      wx.showToast({
        title: 'result is: '+ resultUrl,
      })
    }, function(errorCode){
      //检测无结果或有错误都会回调
      //errorcode 定义请查看buyfullsdk.js
      wx.showToast({
        title: 'error is: ' + errorCode,
      })
    });
  },

})
