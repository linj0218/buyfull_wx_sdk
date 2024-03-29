//index.js
//获取应用实例
var app = getApp()
var detector = app.detector //请查看app.js
Page({
  isDetecting: false,//正在检测中
  retryCount : 3,//重试次数
  reqid: null,
  onLoad: function () {
    //用户拒绝录音授权后会弹出提示框，每次运行只会打开一次
    //请把openSettingTemp中的模板import进来，具体请查看index.wxml和index.wxss
    //如果此页面没有调用录音功能，可以不加载此代码以及相应的模板
    const openRecordSetting = require("../openSettingTemp/openSettingTemp.js");
    openRecordSetting.bindRecordSettingForPage(this,detector); 
  },

  onclick2: function () {
    detector.debugUpload(this.reqid,1);
  },
  onclick: function () {
    if (this.isDetecting){
      return;
    }
    this.doDetect();
  },

  doDetect: function () {
    var thiz = this;
    if (!this.isDetecting){
      this.isDetecting = true;
      this.retryCount = 3;
    }
    detector.detect({
      version: "v2", //针对qieshu.net上的帐号请使用v2
      openID: "", //可选，字符串，微信后台返回
      unionID: "", //可选，字符串，微信后台返回
      phoneNumber: "", //可选，字符串，openid,unionid,phonenumber中可以任意给一个或多个，可以给后台报表数据中作为统计数据的一个参数,没有将无法获得后台统计数据
      customData: ""//,可选，字符串，可以给后台报表数据中作为统计数据回传
    }, function (result) {
      console.log("检测结束,结果是:" + JSON.stringify(result));
      thiz.reqid = result.reqid;
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
    }, function (errorCode, errorMsg) {
      //检测无结果或有错误都会回调
      //errorcode 定义请查看 "buyfullsdk.js"
      console.error(errorMsg);
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
