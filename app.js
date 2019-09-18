//app.js
App({
  detector : require("utils/buyfullsdk"),
  onLaunch: function () {
    this.detector.init({
      //这只是个demo,请联系百蝠获取appkey,同时布署自己的buyfull token service
      // appKey:"121e87d73077403eadd9ab4fec2d9973",
      // buyfullTokenUrl:"https://sandbox.buyfull.cc/wx/buyfulltoken",
      appKey: "75ba120532f44aa7a8cd431a2c2a50ef",
      buyfullTokenUrl: "https://sandbox.buyfull.cc/testycq2/buyfulltoken",
      // abortTimeout: 3000,//单次网络请求超时
      // detectTimeout: 6000,//总超时
      // debugLog: true,//true可以打开debugLog
      limitDB: -120,//当手机录音的分贝数低于此值时不上传检测
    });
    //调用API从本地缓存中获取数据
    var logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)
  },
  getUserInfo:function(cb){
    var that = this
    if(this.globalData.userInfo){
      typeof cb == "function" && cb(this.globalData.userInfo)
    }else{
      //调用登录接口
      wx.login({
        success: function () {
          wx.getUserInfo({
            success: function (res) {
              that.globalData.userInfo = res.userInfo
              typeof cb == "function" && cb(that.globalData.userInfo)
            }
          })
        }
      })
    }
  },
  globalData:{
    userInfo:null
  }
})