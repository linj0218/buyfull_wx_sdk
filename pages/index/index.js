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
      // appKey:"121e87d73077403eadd9ab4fec2d9973",
      // buyfullTokenUrl:"https://sandbox.buyfull.cc/wx/buyfulltoken",
      appKey: "75ba120532f44aa7a8cd431a2c2a50ef",
      buyfullTokenUrl: "https://sandbox.buyfull.cc/testycq2/buyfulltoken",
      // abortTimeout: 3000,//单次网络请求超时
      // detectTimeout: 6000,//总超时
      // debugLog: true,//true可以打开debugLog
    });
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
                  },
                  fail:(err) =>{
                    thiz.doDetect();
                  }
                })
              }
            }, 
            fail: function(err){
              thiz.doDetect();
            }
          });
        }else{
          thiz.doDetect();
        }
      },
      fail:(err) =>{
        thiz.doDetect();
      }
    });
    
  },

  doDetect: function () {
    var thiz = this;
    if (!this.isDetecting){
      this.isDetecting = true;
      this.retryCount = 3;
    }
    detector.detect({
      version: "v2", //针对qieshu.net上的帐号请使用v2
      //userID: "xxxxxxx" //可选，可以以后台报表数据中作为统计数据的一个参数
    }, function (result) {
      console.log("检测结束,结果是:" + JSON.stringify(result));
      if (result.count > 0){
        wx.showModal({
          title: 'result is:',
          content: JSON.stringify(result.allTags),
        })
      }else{
        wx.showModal({
          title: 'result is null, power is (dB):',
          content: result.sortByPowerResult[0].power + "|" + result.sortByPowerResult[1].power,
        })
      }
      
      thiz.isDetecting = false;
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
          detector.debug();
        }
      }else{
        thiz.isDetecting = false;
        wx.showToast({
          title: 'error is: ' + errorCode,
        })
        detector.debug();
      }
    });
  },
})
