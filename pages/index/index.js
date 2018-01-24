//index.js
//获取应用实例
const detector = require("../../utils/buyfullsdk");


var app = getApp()
Page({
  isDetecting: false,//正在检测中
  retryCount : 3,//重试次数

  onLoad: function () {
    detector.init({
      //这只是个demo,请联系百蝠获取appkey,同时布署自己的buyfull token service
      appKey:"121e87d73077403eadd9ab4fec2d9973",
      buyfullTokenUrl:"https://sandbox.buyfull.cc/wx/buyfulltoken",
      abortTimeout: 3000,//单次网络请求超时
      detectTimeout: 5000,//总超时
      debugLog: false,//true可以打开debugLog
    });
  },

  onHide: function (){
    detector.destory();
  },

  onclick: function () {
    if (this.isDetecting){
      return;
    }
    var thiz = this;
    wx.getSetting({
      success:(res) =>{
        console.log(JSON.stringify(res));
        if (res.authSetting["scope.record"] === false){
          wx.showModal({
            title: '提示',
            content: '检测信标只需要录音"1"秒钟。\n您可以在微信右上角查看录音状态。\n我们保证不会收集您的任何个人隐私',
            showCancel: true,
            cancelText: "不打开",
            confirmText: "打开权限",
            success: function (res) {
              if (res.confirm) {
                wx.openSetting({
                  success:(res) =>{
                    if (res.authSetting["scope.record"] === true) {
                      thiz.doDetect();
                    }
                  }
                })
              }
            }
          });
        }else{
          thiz.doDetect();
        }
      }
    });
    
  },

  doDetect: function () {
    var thiz = this;
    if (!this.isDetecting){
      this.isDetecting = true;
      this.retryCount = 3;
    }
    detector.detect(null, function (resultUrl) {
      console.log("检测成功,url是:" + resultUrl);
      //url中的mediaInfo信息可以在营销渠道中的 "其它信息" 内自定义
      wx.showToast({
        title: 'result is: ' + resultUrl,
      })
    }, function (errorCode) {
      //检测无结果或有错误都会回调
      //errorcode 定义请查看 "buyfullsdk.js"
      
      if (errorCode >= 4 && errorCode <= 8){
      //errocode 4-8 都和网络以及超时有关，可以自行设计重试和报错机制,或者延长abortTimeout和detectTimeout
        if (--thiz.retryCount > 0){
          console.log("retry count:" + thiz.retryCount);
          thiz.doDetect();
        }else{
          thiz.isDetecting = false;
          wx.showToast({
            title: 'error is: ' + errorCode,
          })
        }
      }else{
        thiz.isDetecting = false;
        wx.showToast({
          title: 'error is: ' + errorCode,
        })
      }
    });
  },
})
