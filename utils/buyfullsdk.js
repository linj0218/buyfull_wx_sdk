// created by ycq
(function () {
  var err = {
    HAS_NO_RESULT: 0,//检测无结果
    INVALID_APPKEY: 1,//APPKEY不正确
    DUPLICATE_DETECT: 2,//调用太频繁
    RECORD_FAIL: 3,//录音失败
    NETWORK_ERROR: 4,//网络错误
    GET_QINIU_TOKEN_TIMEOUT: 5,//获取七牛TOKEN超时
    UPLOAD_TIMEOUT: 6,//上传超时
    DETECT_TIMEOUT: 7,//检测超时
    GET_BUYFULL_TOKEN_TIMEOUT: 8,//获取BUYFULL TOKEN超时
    INVALID_APPINFO: 9,//APPKEY非法
    GET_QINIU_TOKEN_ERROR: 10,//TOKEN非法
    JSON_PARSE_ERROR: 11,//上传结果非法
    UPLOAD_FAIL: 12,//上传TOKEN非法
    DETECT_ERROR: 13,//检测结果非法
    INVALID_BUYFULL_TOKENURL: 14,//非法的BUYFULL TOKENURL
    GET_BUYFULL_TOKEN_ERROR: 15,//BUYFULL TOKEN非法
    INVALID_QINIU_TOKENURL: 16,//非法的七牛 TOKENURL
    INVALID_DETECT_OPTIONS: 17,//非法的检测参数
    INVALID_REGION: 18,//非法的服务器地域
    NO_RECORD_PERMISSION: 19,//没有录音权限
    WX_VERSION_TOO_LOW: 20,//微信版本太低
    SDK_VERSION_NOT_MATCH: 21,//在qieshu.net上注册的帐号请在detect的option中加入{version:"v2"}
  }

  var config = {
    appKey: '',
    buyfullTokenUrl: '',
    detectTimeout: 6000,//总的超时
    abortTimeout: 2000,//单个API请求的超时
    debugLog: false,//是否打印debuglog
    //
    region: "ECN",
    detectSuffix: 'soundtag-decode/decodev3/place/MP3',
    detectV2Suffix: 'soundtag-decode/decodev5/place/MP3',
  }

  module.exports = {
    init: init,
    destory: destory,
    detect: detect,
    errcode: err,
    debug: printDebugLog,
    setRecordPermissionCallback: setRecordPermissionCallback
  }

  var runtime = {
    lastDetectTime: 0,
    lastRecordTime: 0,
    isRequestingBuyfullToken: false,
    isRequestingQiniuToken: false,
    isRecording: false,
    isUploading: false,
    isDetecting: false,
    requestTask: null,
    abortTimer: null,
    buyfullToken: '',
    qiniuToken: '',
    uploadServer: '',
    qiniuUrl: '',
    resultUrl: '',
    mp3FilePath: '',
    success_cb: null,
    fail_cb: null,
    record_options: {
      duration: 1500,
      sampleRate: 44100,
      numberOfChannels: 1,
      encodeBitRate: 320000,
      format: 'mp3',
    },
    hasRecordInited: false,
    deviceInfo: null,
    userInfo: "",
    ip: "",
    hash: "",
    detectSuffix: '',
    region: '',
    debugLog: '',
    hasShowAccessHint: false,
    hasShowVersionHint: false,
    noRecordPermission: false,
    wxVersionTooLow: false,
    suspended: false,
    lastRecordEvent: "",
    lastRecordError: null,
    checkFormatData: null,
    hasSaveRecordConfig: false,
    userID: "",
    detectVersion: "",
    results: null,
    hasUserPermission: false,
    customData: null,
    hasRecordPermission: false,
    recordPermissionCallback: null,
    hadInit: false,
    hasInitConnection: true,
    fakeMP3Path: '',
  }

  function resetRuntime() {
    runtime.success_cb = null;
    runtime.fail_cb = null;
    runtime.lastDetectTime = Date.now();
    runtime.lastRecordTime = Date.now();
    runtime.isRequestingBuyfullToken = false;
    runtime.isRequestingQiniuToken = false;
    runtime.isRecording = false;
    runtime.isUploading = false;
    runtime.isDetecting = false;
    if (runtime.requestTask != null) {
      runtime.requestTask.abort();
    }
    runtime.requestTask = null;
    if (runtime.abortTimer != null) {
      clearTimeout(runtime.abortTimer);
    }
    runtime.abortTimer = null;
    if (runtime.buyfullToken.startsWith("ERROR_")) {
      runtime.buyfullToken = '';
    }
    // runtime.qiniuToken = '';
    runtime.uploadServer = '';
    runtime.qiniuUrl = '';
    runtime.resultUrl = '';
    runtime.mp3FilePath = '';
    runtime.userID = "";
    runtime.results = null;
    runtime.customData = null;
  }

  function showNotAccessHint(callback) {
    if (!runtime.hasShowAccessHint) {
      runtime.hasShowAccessHint = true;
      if (callback) {
        try {
          if (runtime.recordPermissionCallback) {
            runtime.recordPermissionCallback(callback)
            runtime.recordPermissionCallback = null;
          } else {
            setTimeout(function () {
              callback(false);
            }, 1);
          }
        } catch (e) { }
      }
    } else {
      if (callback) {
        setTimeout(function () {
          callback(false);
        }, 1);
      }
    }
  }

  function init(options) {
    if (!runtime.hadInit) {
      runtime.hadInit = true;

      try {
        checkPermission(3);
      } catch (e) { }

      try {
        updateConfigWithOptions(options);
      } catch (e) { }

      try {
        initcheckFormatData();
      } catch (e) { }

      try {
        registerAppEventHandler();
      } catch (e) { }

      try {
        resetRuntime();
      } catch (e) { }

      try {
        preHeat();
      } catch (e) { }
    }
  }

  function destory() {
    //destoryRecorder();
    //resetRuntime();
  }

  String.prototype.replaceAll = function (FindText, RepText) {
    var regExp = new RegExp(FindText, "g");
    return this.replace(regExp, RepText);
  }

  function setRecordPermissionCallback(callback) {
    if (!runtime.hasRecordPermission) {
      runtime.recordPermissionCallback = callback;
    }
  }

  function checkPermission(retryCount, callback) {
    wx.getSetting({
      success: (res2) => {
        if (res2.authSetting["scope.record"] === false) {
          runtime.noRecordPermission = true;
          runtime.hasRecordPermission = false;
          if (callback)
            callback(false);
        } else if (res2.authSetting["scope.record"] === true) {
          runtime.hasRecordPermission = true;
          runtime.noRecordPermission = false;
          runtime.recordPermissionCallback = null;
          if (callback)
            callback(true);
        }
        if (res2.authSetting["scope.userInfo"] === true) {
          runtime.hasUserPermission = true;
          if (runtime.userInfo == "") {
            wx.login({
              success: function (res1) {
                wx.getUserInfo({
                  success: function (res) {
                    try {
                      delete res.rawData;
                      delete res.encryptedData;
                      delete res.iv;
                      delete res.signature;
                      res.loginCode = res1.code;
                      runtime.userInfo = JSON.stringify(res);
                      debugLog(runtime.userInfo);
                    } catch (e) {
                      debugLog(e);
                    }
                  }
                })
              }
            });
          }
        }
      },
      fail: (err) => {
        if (retryCount > 0) {
          setTimeout(function () {
            checkPermission(retryCount - 1, callback);
          }, 100);
        } else {
          if (callback)
            callback(false);
        }
      }
    });
  }

  function updateConfigWithOptions(options) {
    if (options) {
      config.appKey = options.appKey;
      config.buyfullTokenUrl = options.buyfullTokenUrl;
      if (options.abortTimeout) {
        config.abortTimeout = options.abortTimeout
      }
      if (options.detectTimeout) {
        config.detectTimeout = options.detectTimeout
      }
      if (options.debugLog) {
        config.debugLog = options.debugLog;
      }
      if (options.region) {
        config.region = options.region;
      }
      if (options.detectSuffix) {
        config.detectSuffix = options.detectSuffix;
        config.detectV2Suffix = options.detectSuffix;
      }
    }
  }

  function printDebugLog() {
    if (config.debugLog) {
      wx.showModal({
        title: 'buyfull debug',
        content: runtime.debugLog,
        confirmText: "OK",
      });
      runtime.debugLog = "";
    }
  }

  function debugLog(msg) {
    if (config.debugLog) {
      console.log(msg);
      runtime.debugLog += msg + "\n\n";
    }
  }

  function safe_call(cb, result) {
    debugLog("detect use time: " + (Date.now() - runtime.lastDetectTime));
    if (cb) {
      try {
        cb(result);
      } catch (e) {
        console.error(e);
      }
    }
  }

  function detect(options, success, fail) {

    if (!config.appKey || config.appKey == '') {
      safe_call(fail, err.INVALID_APPKEY);
      return;
    }
    if (!config.buyfullTokenUrl || config.buyfullTokenUrl == '') {
      safe_call(fail, err.INVALID_BUYFULL_TOKENURL);
      return;
    }
    if (!checkRegionCode(config.region)) {
      safe_call(fail, err.INVALID_REGION);
      return;
    }
    if (!checkOptions(options)) {
      safe_call(fail, err.INVALID_DETECT_OPTIONS);
      return;
    }

    if (runtime.wxVersionTooLow) {
      safe_call(fail, err.WX_VERSION_TOO_LOW);
      return;
    }

    if (runtime.hasRecordPermission) {
      _startDetect(options, success, fail);
    } else if (runtime.noRecordPermission) {
      resetRuntime();
      showNotAccessHint(function (hasGotoSetting) {
        if (!hasGotoSetting) {
          safe_call(fail, err.NO_RECORD_PERMISSION);
        } else {
          //check setting again to see if user changed options
          checkPermission(3, function (hasRecordPermission) {
            if (hasRecordPermission) {
              runtime.recordPermissionCallback = null;
              _startDetect(options, success, fail);
            } else {
              safe_call(fail, err.NO_RECORD_PERMISSION);
            }
          });
        }
      });
    } else {
      _tryAuthorize(3, options, success, fail);
    }
  }

  function _tryAuthorize(retryCount, options, success, fail) {
    wx.authorize({
      scope: 'scope.record',
      success: function () {
        runtime.noRecordPermission = false;
        runtime.hasRecordPermission = true;
        runtime.recordPermissionCallback = null;
        _startDetect(options, success, fail);
      },
      fail: function (res) {
        if (retryCount > 0) {
          setTimeout(function () {
            _tryAuthorize(retryCount - 1, options, success, fail);
          }, 100);
        } else {
          runtime.noRecordPermission = true;
          runtime.hasRecordPermission = false;
          resetRuntime();
          safe_call(fail, err.NO_RECORD_PERMISSION);
        }
      }
    });
  }

  function _startDetect(options, success, fail) {
    if ((Date.now() - runtime.lastDetectTime) > 10000) {
      //incase some unknow exception,dead line is 10s
      resetRuntime();
    }
    if (runtime.success_cb || runtime.fail_cb) {
      safe_call(fail, err.DUPLICATE_DETECT);
      return;
    }
    resetRuntime();
    checkOptions(options);//for set param;
    runtime.success_cb = success;
    runtime.fail_cb = fail;
    doCheck();
  }

  function checkRegionCode(code) {
    switch (code) {
      case 'ECN':
      case 'NCN':
      case 'SCN':
        // case 'NA0':
        // case 'AS0':
        return true;
      default:

    }
    return false;
  }

  function checkOptions(options) {
    if (runtime.region == "") {
      runtime.region = config.region;
    }
    runtime.detectSuffix = config.detectSuffix;
    if (options) {
      if (options.version == "v2") {
        runtime.detectVersion = options.version
        runtime.detectSuffix = config.detectV2Suffix;
      } else if (options.version == "check") {
        runtime.detectVersion = options.version
        runtime.detectSuffix = config.detectV2Suffix;
      } else {
        runtime.detectVersion = ""
        runtime.detectSuffix = config.detectSuffix;
      }

      if (options.detectSuffix) {
        runtime.detectSuffix = options.detectSuffix;
      }
      if (options.region) {
        runtime.region = options.region;
      }
      if (!checkRegionCode(runtime.region)) {
        return false;
      }

      if (options.userID) {
        runtime.userID = options.userID;
      }

      if (options.customData) {
        runtime.customData = options.customData;
      }
    }
    return true;
  }

  function initcheckFormatData() {
    if (runtime.deviceInfo == null) {
      try {
        var res = wx.getSystemInfoSync()
        runtime.deviceInfo = res;
        runtime.deviceInfo.str = JSON.stringify(res);
        if (runtime.deviceInfo.platform == "ios") {
          runtime.checkFormatData = [
            { priority: 1, src: "buildInMic", duration: 1200 },
            { priority: 0, src: "auto", duration: 1200 },

          ];
          checkRecordConfig(runtime.checkFormatData);
        } else if (runtime.deviceInfo.platform == "android") {
          try {
            var needHint = false;
            var android7 = false;
            var wx667 = false;

            var system = runtime.deviceInfo.system.split(" ");
            if (system.length >= 2) {
              var androidversion = system[1].split(".");
              if (androidversion.length >= 1 && parseInt(androidversion[0]) >= 7) {
                //it's greater than 7.0
                android7 = true;
              }
            }

            var wxversion = runtime.deviceInfo.version.split(".");
            //check if weixin is greater than 6.6.7
            if (wxversion.length >= 2 && parseInt(wxversion[0]) > 6) {
              wx667 = true;
            }
            else if (wxversion.length >= 2 && parseInt(wxversion[0]) >= 6 && parseInt(wxversion[1]) >= 6) {
              if (wxversion.length >= 2 && parseInt(wxversion[1]) > 6) {
                wx667 = true;
              } else if (wxversion.length >= 3 && parseInt(wxversion[2]) >= 7) {
                wx667 = true;
              }
            }

            runtime.deviceInfo.android7 = android7;
            runtime.deviceInfo.wx667 = wx667;

            var brand = runtime.deviceInfo.brand.toLowerCase();

            if (brand == "oppo") {
              needHint = true;
            } else if (brand == "huawei" || brand == "honor" || brand == "oneplus") {
              if (android7) {
                needHint = true;
              }
            }

            if (needHint && !wx667) {
              showWX667Hint();
            }

            loadRecordConfig();
          } catch (e) {

          }
        } else {
          runtime.checkFormatData = [
            { priority: 1, src: "auto", duration: 1200 },
          ];
          checkRecordConfig(runtime.checkFormatData);
        }
        debugLog(runtime.deviceInfo.str);
      } catch (e) {
        debugLog("Cant get device info");
        runtime.deviceInfo = {};
        runtime.deviceInfo.str = "";
      }
    }
  }

  function showWX667Hint() {
    if (!runtime.hasShowVersionHint) {
      runtime.wxVersionTooLow = true;
      wx.showModal({
        title: '提示',
        content: '微信版本低于6.6.7，请升级微信后才能正常使用',
        showCancel: false,
        confirmText: "知道了",
        success: function (res) {
          runtime.hasShowVersionHint = true;
        }
      });
    }
  }

  function showNotSupportHint() {
    if (!runtime.hasShowVersionHint) {
      runtime.wxVersionTooLow = true;
      wx.showModal({
        title: '提示',
        content: '当前设备无法使用声波检测',
        showCancel: false,
        confirmText: "知道了",
        success: function (res) {
          runtime.hasShowVersionHint = true;
        }
      });
    }
  }

  function loadRecordConfig() {
    //load local config first
    try {
      var record_option_json = wx.getStorageSync("buyfull_record_option")
      if (record_option_json) {
        var newconfig = JSON.parse(record_option_json)
        if (checkRecordConfig(newconfig))
          runtime.checkFormatData = newconfig;
      }
    } catch (e) {
    }
    //load global model config then
    if (!runtime.checkFormatData) {
      var brand = encodeURIComponent(runtime.deviceInfo.brand.toUpperCase().replaceAll(" ", "_"));
      var model = encodeURIComponent(runtime.deviceInfo.model.toUpperCase().replaceAll(" ", "_"));
      var system = encodeURIComponent(runtime.deviceInfo.system.toUpperCase().replaceAll(" ", "_"));
      var configurl = "https://cloud.euphonyqr.com/android_config/" + brand + "_" + model + "_" + system + ".json";
      runtime.requestTask = wx.request({
        url: configurl,
        success: function (res) {
          clearAbortTimer();
          runtime.requestTask = null;
          try {
            var newconfig = res.data
            if (checkRecordConfig(newconfig)) {
              debugLog("load config: " + configurl);
              runtime.checkFormatData = newconfig;
              if (runtime.success_cb || runtime.fail_cb) {
                reDoCheck();
              }
            } else {
              loadDefaultRecordConfig();
            }
          } catch (e) {
            loadDefaultRecordConfig();
          }
        },
        fail: function (error) {
          clearAbortTimer();
          debugLog("load config fail: " + configurl);
          runtime.requestTask = null;
          loadDefaultRecordConfig();
        }
      });
      setAbortTimer();
    }
  }

  function saveRecordConfig() {
    //save local config
    if (runtime.hasSaveRecordConfig) {
      return;
    }
    runtime.hasSaveRecordConfig = true;
    try {
      //only save priority
      //TODO
      var json = JSON.stringify(runtime.checkFormatData);
      wx.setStorageSync("buyfull_record_option", json);
    } catch (e) {

    }
  }

  function checkRecordConfig(config) {
    try {
      if (config && config.length >= 1) {
        for (var index = 0; index < config.length; ++index) {
          config[index].power = 0;
          config[index].success = 0;
          config[index].startTime = 0;
          config[index].recordPeriod = 0;
        }
        return true;
      }
    } catch (e) {

    }
    return false;
  }

  function loadDefaultRecordConfig() {
    //try default model config then
    var brand = runtime.deviceInfo.brand.toLowerCase();
    debugLog("load default config: " + brand);
    runtime.checkFormatData = [
      { priority: 5, src: "unprocessed", duration: 1550 },
      { priority: 4, src: "camcorder", duration: 1550 },
      { priority: 3, src: "mic", duration: 1550 },
      { priority: 2, src: "voice_recognition", duration: 1550 },
      { priority: 1, src: "voice_communication", duration: 1550 },
      { priority: 0, src: "auto", duration: 1550 },
    ];

    if (brand == "oppo") {
      runtime.checkFormatData = [
        { priority: 3, src: "unprocessed", duration: 1550 },
        { priority: 5, src: "camcorder", duration: 1550 },
        { priority: 4, src: "mic", duration: 1550 },
        { priority: 0, src: "auto", duration: 1550 },
      ];
    } else if (brand == "vivo") {
      runtime.checkFormatData = [
        { priority: 0, src: "unprocessed", duration: 1550 },
        { priority: 3, src: "camcorder", duration: 1550 },
        { priority: 4, src: "mic", duration: 1550 },
        { priority: 5, src: "auto", duration: 1550 },
      ];
    } else if (brand == "xiaomi" || brand == "mi") {
      runtime.checkFormatData = [
        { priority: 0, src: "unprocessed", duration: 1550 },
        { priority: 4, src: "camcorder", duration: 1550 },
        { priority: 3, src: "mic", duration: 1550 },
        { priority: 5, src: "auto", duration: 1550 },
      ];
    } else if (brand == "huawei" || brand == "honor") {
      runtime.checkFormatData = [
        { priority: 5, src: "unprocessed", duration: 1550 },
        { priority: 3, src: "voice_recognition", duration: 1550 },
        { priority: 4, src: "camcorder", duration: 1550 },
        { priority: 0, src: "auto", duration: 1550 },
      ];
    }

    if (!runtime.deviceInfo.android7) {
      runtime.checkFormatData.shift();
    }
    if (!runtime.deviceInfo.wx667) {
      runtime.checkFormatData = [
        { priority: 0, src: "auto", duration: 1550 },
      ];
    }
    checkRecordConfig(runtime.checkFormatData);

    if (!runtime.noRecordPermission && (runtime.success_cb || runtime.fail_cb)) {
      reDoCheck();
    }
  }

  function compareChannelPower(a, b) {
    if (a.power < b.power) return 1;
    if (a.power > b.power) return -1;
    return 0;
  }

  function handleRecordResult(retCode, retData) {
    //go though return data
    if (retData.result && retData.result.length > 0) {
      for (var index = 0; index < retData.result.length; ++index) {
        retData.result[index].channel = index;
      }
      retData.rawResult = retData.result;
      var sortedArray = retData.result.slice();
      sortedArray.sort(compareChannelPower);
      retData.sortByPowerResult = sortedArray;
      var validResult = [];
      var tags = [];
      for (var index = 0; index < sortedArray.length; ++index) {
        if (sortedArray[index].tags.length > 0) {
          validResult.push(sortedArray[index]);
          for (var i = 0; i < sortedArray[index].tags.length; ++i) {
            if (tags.indexOf(sortedArray[index].tags[i]) == -1) {
              tags.push(sortedArray[index].tags[i]);
            }
          }
        }
      }
      retData.result = validResult;
      retData.count = validResult.length;
      retData.allTags = tags;
    } else {
      retData.count = 0;
      retData.result = [];
      retData.sortByPowerResult = [];
      retData.rawResult = [];
      retData.allTags = [];
    }

    if (retData.validResultCount > 0) {
      handleSuccessRecord(0, retData.start + "|" + retData.power);
    } else if (retCode == 0) {
      handleFailRecord(retCode, retData.start + "|" + retData.power);
    } else if (retCode >= 9 && retCode <= 20) {
      handleFailRecord(retCode, retData.start + "|" + retData.period);
    }

    delete retData.code;
    delete retData.start;
    delete retData.period;
    runtime.results = retData;
  }


  function handleSuccessRecord(retCode, retInfo) {
    //if succeed , improve priority
    var info = retInfo.split("|")
    var power = 0;
    var startTime = 0;

    startTime = parseInt(info[0])
    power = parseFloat(info[1])

    runtime.checkFormatData[0].startTime = startTime;
    runtime.checkFormatData[0].power = power;
    runtime.checkFormatData[0].success += 20;
    if (runtime.checkFormatData[0].success > 60) {
      runtime.checkFormatData[0].success = 60;
    }
    // saveRecordConfig();
  }

  function handleFailRecord(retCode, retInfo) {
    if (retCode == 9) {
      runtime.checkFormatData[0].power = -120;
      return;
    }

    if (retCode == 10) {
      //record is empty
      if (!runtime.deviceInfo.wx667) {
        //nothing we can do if wx is below 6.6.7
        showWX667Hint();
      } else {
        runtime.checkFormatData[0].power = -120;
        //if only one option left, show not support
        if (runtime.checkFormatData.length == 1) {
          showNotSupportHint();
        }
      }

      return;
    }

    var info = retInfo.split("|")
    var power = 0;
    var startTime = 0;
    var moreLength = 0;
    if (retCode == 0) {
      startTime = parseInt(info[0])
      power = parseFloat(info[1])
    } else if (retCode == 11) {
      startTime = parseInt(info[0])
      moreLength = parseInt(info[1])
    }

    runtime.checkFormatData[0].startTime = startTime;

    if (retCode == 11) {
      //record is too short
      if (retCode == 11 && (startTime <= 500 && moreLength <= 1000)) {
        if (runtime.checkFormatData[0].duration == 1800) {
          runtime.checkFormatData[0].power = -120;
        } else {
          runtime.checkFormatData[0].duration += (((moreLength + 50) / 50) * 50);
          if (runtime.checkFormatData[0].duration > 1800) {
            runtime.checkFormatData[0].duration = 1800;
            runtime.checkFormatData[0].power = -120;
          }
        }

        return;
      } else {
        runtime.checkFormatData[0].power = -120;
        runtime.checkFormatData[0].duration = 1800;
        //this option is not valid now
        if (runtime.checkFormatData.length == 1) {
          showNotSupportHint();
        }
      }
      return;
    }

    if (retCode == 0) {
      if (power != 0) {
        runtime.checkFormatData[0].power = power;
      }

      if (runtime.checkFormatData[0].success > 0) {
        --runtime.checkFormatData[0].success;
      }
    }
  }

  function getScore(config) {
    var success_score = config.success;
    if (success_score > 60) {
      success_score = 60;
    } else if (success_score < 0) {
      success_score = 0;
    }

    var power_score = 0;
    if (config.power >= 0) {
      power_score = 20;
    } else if (config.power < -120) {
      power_score = 0;
    } else {
      power_score = ((120 + config.power) / 120.0) * 20
    }

    var duration_score = 0;
    if (config.duration <= 1000) {
      duration_score = 8;
    } else if (config.duration >= 1800) {
      duration_score = 0;
    } else {
      duration_score = (1800 - config.duration) / 1000.0 * 8
    }

    var start_score = 0;
    if (config.startTime <= 0) {
      start_score = 10;
    } else if (config.startTime >= 1000) {
      start_score = 0;
    } else {
      start_score = (1000 - config.startTime) / 1000.0 * 10
    }

    return config.priority + success_score + power_score + duration_score + start_score;
  }

  function compareRecordConfig(a, b) {
    var checkVal1 = getScore(a);
    var checkVal2 = getScore(b);
    if (checkVal1 < checkVal2) return 1;
    if (checkVal1 > checkVal2) return -1;
    return 0;
  }

  function doCheck() {
    if (!runtime.checkFormatData || runtime.isRequestingBuyfullToken || runtime.isRequestingQiniuToken || runtime.isUploading || runtime.isDetecting)
      return;

    if ((Date.now() - runtime.lastDetectTime) > config.detectTimeout) {
      //incase deadloop
      if (runtime.resultUrl != "") {
        //if it has final result, let's return it
        if (!runtime.resultUrl.startsWith("ERROR_")) {
          callSuccess();
        } else {
          callFail(err.DETECT_TIMEOUT);
        }
      } else {
        callFail(err.DETECT_TIMEOUT);
      }
      return;
    }

    var hasBuyfullToken = false;
    var hasQiniuToken = false;
    var hasMP3 = false;
    var hasUploaded = false;

    //check buyfull token
    if (runtime.buyfullToken == '') {
      doGetBuyfullToken(false);
    } else if (runtime.buyfullToken == 'REFRESH') {
      runtime.buyfullToken = "";
      doGetBuyfullToken(true);
    } else if (runtime.buyfullToken.startsWith("ERROR_")) {
      if (runtime.buyfullToken == 'ERROR_ABORT') {
        debugLog("GET_BUYFULL_TOKEN_TIMEOUT");
        runtime.buyfullToken = "";
        reDoCheck();
        // safe_call(fail_cb, err.GET_BUYFULL_TOKEN_TIMEOUT);
      } else {
        if (runtime.buyfullToken == 'ERROR_SERVER') {
          callFail(err.GET_BUYFULL_TOKEN_ERROR);
        } else if (runtime.buyfullToken == 'ERROR_HTTP') {
          callFail(err.NETWORK_ERROR);
        }
      }
      return;
    } else {
      hasBuyfullToken = true;
    }

    //check & record mp3 file
    if (!runtime.isRecording) {

      if (runtime.mp3FilePath == '') {
        //only record if called by detect
        if (runtime.success_cb || runtime.fail_cb)
          doRecord();
      } else if (runtime.mp3FilePath.startsWith("ERROR_")) {
        callFail(err.RECORD_FAIL);
        return;
      } else {
        hasMP3 = true;
      }
    }
    //check detect result
    if (runtime.resultUrl == '') {
      // if (hasUploaded && hasBuyfullToken)
      //   doDetect();
      if (hasMP3 && hasBuyfullToken)
        doBuyfullDetect();
    } else if (runtime.resultUrl.startsWith("ERROR_")) {
      if (runtime.resultUrl == 'ERROR_ABORT') {
        // safe_call(fail_cb, err.DETECT_TIMEOUT);
        debugLog("DETECT_TIMEOUT");
        runtime.resultUrl = "";
        reDoCheck();
      } else {
        if (runtime.resultUrl == 'ERROR_SERVER') {
          callFail(err.DETECT_ERROR);
        } else if (runtime.resultUrl == 'ERROR_HTTP') {
          callFail(err.NETWORK_ERROR);
        } else if (runtime.resultUrl == 'ERROR_NO_RESULT') {
          callFail(err.HAS_NO_RESULT);
        } else if (runtime.resultUrl == 'ERROR_REGION') {
          callFail(err.INVALID_REGION);
        } else if (runtime.resultUrl == "ERROR_SDK_VERSION") {
          callFail(err.SDK_VERSION_NOT_MATCH);
        }
      }
      return;
    } else {
      callSuccess();
    }
  }

  function callSuccess() {
    //success callback
    debugLog("detect use time: " + (Date.now() - runtime.lastDetectTime));
    runtime.fail_cb = null;
    var success_cb = runtime.success_cb;
    runtime.success_cb = null;
    if (runtime.detectVersion == "v2") {
      safe_call(success_cb, runtime.results);
    } else {
      safe_call(success_cb, runtime.resultUrl);
    }
  }

  function callFail(errcode) {
    debugLog("detect fail with time: " + (Date.now() - runtime.lastDetectTime));
    runtime.success_cb = null;
    var fail_cb = runtime.fail_cb;
    runtime.fail_cb = null;
    safe_call(fail_cb, errcode);
  }

  function reDoCheck() {
    if (runtime.suspended)
      return;
    setTimeout(doCheck, 1);
  }

  function clearAbortTimer() {
    if (runtime.abortTimer != null) {
      clearTimeout(runtime.abortTimer);
      runtime.abortTimer = null;
    }
  }

  function setAbortTimer() {
    clearAbortTimer();
    runtime.abortTimer = setTimeout(function () {

      if (runtime.requestTask != null) {
        runtime.requestTask.abort();
        runtime.requestTask = null;
      }

    }, config.abortTimeout);
  }

  function preHeat() {
    clearAbortTimer();
    runtime.requestTask = wx.request({
      url: "https://api.euphonyqr.com/api/ip",
      success: function (res) {
        clearAbortTimer();
        runtime.ip = res.data;
      },
      fail: function (error) {
        clearAbortTimer();
      }
    });
    setAbortTimer();
  }

  function doGetBuyfullToken(refreshToken) {
    if (runtime.isRequestingBuyfullToken)
      return;

    debugLog("doGetBuyfullToken:" + config.buyfullTokenUrl);
    clearAbortTimer();
    runtime.isRequestingBuyfullToken = true;

    var params = {
      "nocache": Math.random() * 10000000000,
      "appkey": config.appKey
    }
    if (refreshToken) {
      params.refresh = "true"
    }

    runtime.requestTask = wx.request({
      url: config.buyfullTokenUrl,
      data: params,
      success: function (res) {
        if (!runtime.isRequestingBuyfullToken)
          return;
        clearAbortTimer();
        runtime.isRequestingBuyfullToken = false;
        runtime.requestTask = null;
        var code = res.data.code;
        var buyfullToken = res.data.token;
        if (runtime.buyfullToken == '') {
          if (code && code == 200 && buyfullToken && buyfullToken.length > 0) {
            runtime.buyfullToken = buyfullToken;
            debugLog(buyfullToken);
          } else {
            runtime.buyfullToken = "ERROR_SERVER";
          }

          reDoCheck();
        }

      },
      fail: function (error) {
        console.error(JSON.stringify(error))
        if (!runtime.isRequestingBuyfullToken)
          return;
        clearAbortTimer();
        runtime.isRequestingBuyfullToken = false;
        runtime.requestTask = null;
        if (runtime.buyfullToken == '') {
          if (error && error.errMsg && error.errMsg == "request:fail abort") {
            runtime.buyfullToken = "ERROR_ABORT";
          } else {
            runtime.buyfullToken = "ERROR_HTTP";
          }

          reDoCheck();
        }
      }
    });
    setAbortTimer();
  }

  function onShow(options) {
    try {
      debugLog("buyfull onShow");
      if (runtime.suspended) {
        runtime.suspended = false;
        if (runtime.isRecording) {
          debugLog("restart record");
          runtime.isRecording = false;
          runtime.mp3FilePath = "";
          retryRecord();
        }
        if (runtime.success_cb || runtime.fail_cb) {
          debugLog("restart detect");
          reDoCheck();
        }
      }
    } catch (e) {
      debugLog("error in buyfull onShow: " + JSON.stringify(e));
    }
    if (this.oldOnShow) {
      try {
        this.oldOnShow(options);
      } catch (e) {

      }
    }
  }

  function onHide(options) {
    try {
      debugLog("buyfull onHide");
      if (!runtime.suspended) {
        runtime.suspended = true;
      }
    } catch (e) {
      debugLog("error in buyfull onHide: " + JSON.stringify(e));
    }
    if (this.oldOnHide) {
      try {
        this.oldOnHide(options);
      } catch (e) {

      }
    }
  }

  function registerAppEventHandler() {
    var oldOnShow = getApp().onShow;
    var oldOnHide = getApp().onHide;

    getApp().onShow = onShow.bind({
      oldOnShow: oldOnShow
    })
    getApp().onHide = onHide.bind({
      oldOnHide: oldOnHide
    });
  }


  function destoryRecorder() {
    //don't use it anymore
  }

  function retryRecord() {
    if (runtime.suspended)
      return;
    setTimeout(function () {
      doRecord(true);
    }, 1);
  }

  function doRecord(isRetry) {
    if (runtime.isRecording || runtime.suspended)
      return;

    debugLog("doRecord");
    const recordManager = wx.getRecorderManager();

    if (!runtime.hasRecordInited) {
      runtime.hasRecordInited = true;

      recordManager.onStart(() => {
        debugLog('recorder on start');
        runtime.lastRecordEvent = "ONSTART";
        runtime.lastRecordError = null
        runtime.lastRecordTime = Date.now();
        runtime.isRecording = true;
      });

      recordManager.onError((errMsg) => {
        debugLog("record on error:" + JSON.stringify(errMsg));
        runtime.lastRecordEvent = "ONERROR";
        if (errMsg && errMsg.errMsg)
          runtime.lastRecordError = errMsg.errMsg.toString();

        if (!runtime.isRecording) {
          //only deal error if not started
          retryRecord();
        }
      });

      recordManager.onPause(() => {
        debugLog("on pause");
        runtime.lastRecordEvent = "ONPAUSE";
        runtime.lastRecordError = null;

        if (runtime.isRecording) {
          //if it's not onhide, there must be something wrong
          if (!runtime.suspended) {
            runtime.isRecording = false;
            runtime.mp3FilePath = "ERROR_RECORD";
            reDoCheck();
          }
        }
      });

      recordManager.onStop((res) => {
        debugLog("onStop");
        runtime.lastRecordEvent = "ONSTOP";
        runtime.lastRecordError = null;

        if (runtime.isRecording) {
          runtime.isRecording = false;
          if (runtime.mp3FilePath == '') {
            if ((res.duration < 1100) || (res.fileSize <= 0)) {
              debugLog("Record on stop error:" + JSON.stringify(res));
              runtime.mp3FilePath = "ERROR_RECORD";
            } else {
              debugLog("Record on stop success:" + JSON.stringify(res));
              runtime.mp3FilePath = res.tempFilePath;
              runtime.checkFormatData[0].recordPeriod = parseInt(res.duration);
            }
          }
        }
        reDoCheck();
      });
    }
    doStartRecorder(isRetry);
  }


  function doStartRecorder(isRetry) {
    //each time do sort 
    if (runtime.checkFormatData.length > 1) {
      runtime.checkFormatData.sort(compareRecordConfig);
      debugLog("sort config: " + JSON.stringify(runtime.checkFormatData));
    }

    runtime.record_options.audioSource = runtime.checkFormatData[0].src;
    runtime.record_options.duration = runtime.checkFormatData[0].duration;
    debugLog("doStartRecorder: " + runtime.record_options.audioSource + " : " + runtime.record_options.duration + " : " + runtime.lastRecordEvent);

    if (runtime.lastRecordEvent == "START") {
      //if time is too long, that's something wrong
      if ((Date.now() - runtime.lastRecordTime) > 2000) {
        wx.getRecorderManager().stop();
        runtime.lastRecordEvent = "STOP";
      }
    } else if (runtime.lastRecordEvent == "ONSTART") {
      //if time is too long, that's something wrong
      if ((Date.now() - runtime.lastRecordTime) < 2000) {
        runtime.isRecording = true;
      } else {
        wx.getRecorderManager().stop();
        runtime.lastRecordEvent = "STOP";
      }
    } else if (runtime.lastRecordEvent == "" || runtime.lastRecordEvent == "ONSTOP") {
      wx.getRecorderManager().start(runtime.record_options);
      runtime.lastRecordEvent = "START";
    } else if (runtime.lastRecordEvent == "ONPAUSE") {
      wx.getRecorderManager().stop();
      runtime.lastRecordEvent = "STOP";
    } else if (runtime.lastRecordEvent == "ONERROR") {
      if ((Date.now() - runtime.lastRecordTime) > 2000) {
        //onerror take too much time, return record error
        runtime.mp3FilePath = "ERROR_RECORD";
        reDoCheck();
        return;
      }
      if (runtime.lastRecordError != "operateRecorder:fail:audio is stop, don't stop record again") {
        wx.getRecorderManager().stop();
        runtime.lastRecordEvent = "STOP";
        return;
      }
      if (runtime.lastRecordError != "operateRecorder:fail:audio is recording, don't start record again") {
        wx.getRecorderManager().start(runtime.record_options);
        runtime.lastRecordEvent = "START";
        return;
      }
    }

  }

  function loadSetHash() {
    //load hash
    try {
      var hashCode = wx.getStorageSync("buyfull_hash")
      if (hashCode) {
        if (hashCode != "" && hashCode.startsWith(config.appKey + ":"))
          runtime.hash = hashCode;
      }
    } catch (e) {

    }
    if (runtime.hash == null || runtime.hash == "") {
      //create hash and store
      try {
        var input = JSON.stringify(runtime.deviceInfo) + runtime.ip + Math.random();
        runtime.hash = config.appKey + ":" + djb2Code(input);
        wx.setStorageSync("buyfull_hash", runtime.hash);
      } catch (e) {

      }
    }
  }

  function djb2Code(str) {
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
      var char = str.charCodeAt(i);
      hash = ((hash << 5) + hash) + char; /* hash * 33 + c */
    }
    return hash;
  }

  function getBuyfullDetectCmd(info) {
    var infos = {
      "appkey": config.appKey,
      "buyfulltoken": runtime.buyfullToken,
      "ip": runtime.ip,
      "hash": runtime.hash,
      "userid": runtime.userID,
      "customdata": runtime.customData ? JSON.stringify(runtime.customData) : "",
      "deviceinfo": runtime.deviceInfo.str,
      "info": info,
      "userinfo": runtime.userInfo
    }
    return runtime.detectSuffix + "/" + JSON.stringify(infos);
  }

  function doBuyfullDetect() {
    if (runtime.isDetecting)
      return;

    if (runtime.hash == "") {
      loadSetHash()
    }

    var info = runtime.checkFormatData[0].src + "_" + runtime.checkFormatData[0].recordPeriod;

    var cmd = getBuyfullDetectCmd(info)
    debugLog("doDetect:" + cmd);

    if (runtime.deviceInfo.brand == "devtools") {
      //don't do check if it's weixin devtools
      clearAbortTimer();
      setTimeout(function () {
        runtime.resultUrl = "ERROR_NO_RESULT";
        reDoCheck();
      });

      return;
    }

    clearAbortTimer();
    runtime.isDetecting = true;

    var formData = {
      'cmd': cmd,
    };

    runtime.requestTask = wx.uploadFile({
      url: "https://api.euphonyqr.com/api/decode",
      filePath: runtime.mp3FilePath,
      name: 'file',
      formData: formData,
      success: function (res) {
        runtime.hasInitConnection = true;
        if (!runtime.isDetecting)
          return;
        clearAbortTimer();
        runtime.isDetecting = false;
        runtime.requestTask = null;
        const data = JSON.parse(res.data)
        var code = data.code;
        var result = data.result;
        if (runtime.resultUrl == '') {
          debugLog("data is:" + JSON.stringify(data));
          if (runtime.detectVersion == "v2") {
            if (code == 0) {
              if (result) {
                runtime.resultUrl = "OK";
              } else {
                runtime.resultUrl = "ERROR_NO_RESULT";
              }
              handleRecordResult(code, data);
            } else {
              if (code == 100) {
                //wrong buyfull token
                runtime.buyfullToken = "REFRESH";
              } if (code == 101) {
                //wrong sdk version
                runtime.resultUrl = "ERROR_SDK_VERSION";
              } else if (code >= 9 && code <= 20) {
                handleRecordResult(code, data);
                runtime.resultUrl = "ERROR_NO_RESULT";
              } else {
                runtime.resultUrl = "ERROR_SERVER";
              }
            }
          } else if (runtime.detectVersion == "check") {
            if (code == 0) {
              runtime.resultUrl = data.token;
            } else {
              if (code == 100) {
                //wrong buyfull token
                runtime.buyfullToken = "REFRESH";
              } if (code == 101) {
                //wrong sdk version
                runtime.resultUrl = "ERROR_SDK_VERSION";
              } else if (code >= 9 && code <= 20) {
                handleRecordResult(code, data);
                runtime.resultUrl = "ERROR_NO_RESULT";
              } else {
                runtime.resultUrl = "ERROR_SERVER";
              }
            }
          } else {
            if (code == 0 && result && result.length > 0) {
              runtime.resultUrl = result;
              handleSuccessRecord(code, data.info)
            } else {
              if (code == 100) {
                //wrong buyfull token
                runtime.buyfullToken = "REFRESH";
              } if (code == 101) {
                //wrong sdk version
                runtime.resultUrl = "ERROR_SDK_VERSION";
              } else if (code == 0) {
                handleFailRecord(code, data.info);
                runtime.resultUrl = "ERROR_NO_RESULT";
              } else if (code >= 9 && code <= 20) {
                handleFailRecord(code, data.info);
                runtime.resultUrl = "ERROR_NO_RESULT";
              } else {
                runtime.resultUrl = "ERROR_SERVER";
              }
            }
          }

          reDoCheck();
        }

      },
      fail: function (error) {
        runtime.hasInitConnection = true;
        console.error(JSON.stringify(error))
        if (!runtime.isDetecting)
          return;
        clearAbortTimer();
        runtime.isDetecting = false;
        runtime.requestTask = null;
        if (runtime.resultUrl == '') {
          if (error && error.errMsg && error.errMsg == "request:fail abort") {
            runtime.resultUrl = "ERROR_ABORT";
          } else {
            runtime.resultUrl = "ERROR_HTTP";
          }

          reDoCheck();
        }
      }
    });
    setAbortTimer();
  }

  ////////////////////////////////////////////////////////////////////

})();