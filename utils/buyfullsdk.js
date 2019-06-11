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
    apiServer: "https://api.euphonyqr.com/",
    appKey: '',
    buyfullTokenUrl: '',
    detectTimeout: 6000,//总的超时
    abortTimeout: 2000,//单个API请求的超时
    mp3ValidTimeout: 2000,//mp3录音有效时间
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
      duration: 600000,
      sampleRate: 44100,
      numberOfChannels: 1,
      encodeBitRate: 320000,
      frameSize: 22,
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
    mp3Buffer: new Uint8Array(50 * 1024),
    recorderStatus: {
      lastRecordTime: 0,
      lastRecordCmd: "",
      lastRecordEvent: "",
      lastRecordSource: "",
      lastRecordError: null,
      lastFrameTimeStamp: 0,
      lastValidFrameTimeStamp: 0,
      lastFrameTimePeriod: 0,
      lastMP3Head: null,
      lastMP3Frames: [],
      lastRAWMP3Frame: null,
      lastRAWMP3FrameTimeStamp: 0,
    }
  }

  function resetRuntime() {
    runtime.success_cb = null;
    runtime.fail_cb = null;
    runtime.lastDetectTime = Date.now();
    runtime.isRequestingBuyfullToken = false;
    runtime.isRequestingQiniuToken = false;

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

  function compareVersion(v1, v2) {
    v1 = v1.split('.')
    v2 = v2.split('.')
    const len = Math.max(v1.length, v2.length)

    while (v1.length < len) {
      v1.push('0')
    }
    while (v2.length < len) {
      v2.push('0')
    }

    for (let i = 0; i < len; i++) {
      const num1 = parseInt(v1[i])
      const num2 = parseInt(v2[i])

      if (num1 > num2) {
        return 1
      } else if (num1 < num2) {
        return -1
      }
    }

    return 0
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
          startRecord({ isAutoStart: true });
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
      if (runtime.success_cb != success || runtime.fail_cb != fail)
        safe_call(fail, err.DUPLICATE_DETECT);
      return;
    }
    resetRuntime();

    checkOptions(options);//for set param;
    runtime.success_cb = success;
    runtime.fail_cb = fail;
    startRecord({ isDetect: true });
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
              if (androidversion.length >= 1 && parseInt(androidversion[0]) >= 2 && parseInt(androidversion[0]) <= 6) {

              } else {
                //it's greater than 7.0
                android7 = true;
              }
            }
            const version = runtime.deviceInfo.version;
            if (compareVersion(version, '6.6.7') >= 0) {
              wx667 = true;
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

            loadDefaultRecordConfig();
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


  function checkRecordConfig(config) {
    try {
      if (config && config.length >= 1) {
        for (var index = 0; index < config.length; ++index) {
          config[index].power = 0;
          config[index].success = 0;
          config[index].startTime = 0;
          config[index].recordPeriod = 0;
        }
        startRecord({ isAutoStart: true });
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
  }

  function handleFailRecord(retCode, retInfo) {
    if (retCode == 9) {
      runtime.checkFormatData[0].power = -120;
      return;
    }

    if (retCode == 10) {
      //record is empty
      if (!runtime.deviceInfo.wx667 && runtime.deviceInfo.platform == "android") {
        //nothing we can do if wx is below 6.6.7
        showWX667Hint();
      } else {
        runtime.checkFormatData[0].power = -120;
        //if only one option left, show not support
        if (runtime.checkFormatData.length == 1 && runtime.deviceInfo.platform == "android") {
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
    if (((Date.now() - runtime.recorderStatus.lastValidFrameTimeStamp) <= config.mp3ValidTimeout) && (getMP3Stream(true) === true)) {
      hasMP3 = true;
      _doPause();
    } else {
      //wait record ready till mp3 timeout
      if (runtime.isRecording && ((Date.now() - runtime.lastDetectTime) >= config.mp3ValidTimeout)) {
        callFail(err.RECORD_FAIL);
        return;
      }
    }
    //check detect result
    if (runtime.resultUrl == '') {
      if (runtime.deviceInfo.brand == "devtools") {
        //don't do check if it's weixin devtools
        clearAbortTimer();
        setTimeout(function () {
          runtime.resultUrl = "ERROR_NO_RESULT";
          reDoCheck();
        });
        return;
      }
      if (hasMP3 && hasBuyfullToken) {
        doBuyfullDetect();
      }

    } else if (runtime.resultUrl.startsWith("ERROR_")) {
      if (runtime.resultUrl == 'ERROR_ABORT') {
        callFail(err.DETECT_TIMEOUT);
        // debugLog("DETECT_TIMEOUT");
        // runtime.resultUrl = "";
        // reDoCheck();
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
    if (runtime.suspended || !runtime.success_cb || !runtime.fail_cb)
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
      url: config.apiServer + "api/ip",
      success: function (res) {
        clearAbortTimer();
        runtime.ip = res.data;
        doGetBuyfullToken(false);
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
        if (res.statusCode != 200 && runtime.buyfullToken == '') {
          runtime.buyfullToken = "ERROR_SERVER";
          reDoCheck();
          return;
        }
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

        if (runtime.success_cb || runtime.fail_cb) {
          debugLog("restart detect");
          runtime.lastDetectTime = Date.now();
          startRecord({ isSuspend: true });
          reDoCheck();
        }
      }
    } catch (e) {
      debugLog("error in buyfull onShow: " + JSON.stringify(e));
    }
    if (this && this.oldOnShow) {
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
        runtime.recorderStatus.lastRecordEvent = "ONINTERRUPT";
        runtime.recorderStatus.lastRecordError = null;
      }
    } catch (e) {
      debugLog("error in buyfull onHide: " + JSON.stringify(e));
    }
    if (this && this.oldOnHide) {
      try {
        this.oldOnHide(options);
      } catch (e) {

      }
    }
  }

  function registerAppEventHandler() {
    const version = wx.getSystemInfoSync().SDKVersion
    if (compareVersion(version, '2.1.2') >= 0) {
      wx.onAppShow((options) => {
        onShow(options);
      });
      wx.onAppHide((options) => {
        onHide(options);
      });
    } else {
      var oldOnShow = getApp().onShow;
      var oldOnHide = getApp().onHide;

      getApp().onShow = onShow.bind({
        oldOnShow: oldOnShow
      })
      getApp().onHide = onHide.bind({
        oldOnHide: oldOnHide
      });
    }
  }


  function destoryRecorder() {
    //don't use it anymore
  }

  function startRecord(option) {
    if (runtime.suspended || !runtime.hasRecordPermission || !runtime.checkFormatData)
      return;
    debugLog("start record:" + JSON.stringify(option));
    if (option) {
      if (option.isOnError) {

      }
      if (option.isSuspend) {
        _doStop();
        return;
      }
      if (option.isAutoStart) {

      }
      if (option.isOnPause) {
        //_doStop();
        //return;
      }
      if (option.isOnStop) {
        if (runtime.deviceInfo.platform == "ios") {
          setTimeout(function () {
            doRecord(option);
          }, 3000);//for prevent video bug
          return;
        }
      }
      if (option.isOnFrame) {
        _doStop();
        return;
      }
      if (option.isDetect) {
      }
    }

    setTimeout(function () {
      doRecord(option);
    }, 1);
  }

  function doRecord(option) {
    if (runtime.isRecording || runtime.suspended || !runtime.checkFormatData)
      return;

    debugLog("doRecord:" + JSON.stringify(option));
    const recordManager = wx.getRecorderManager();

    if (!runtime.hasRecordInited) {
      runtime.hasRecordInited = true;

      recordManager.onStart(() => {
        debugLog('recorder on start');
        _clearRecordAbortTimer();
        runtime.recorderStatus.lastRecordEvent = "ONSTART";
        runtime.recorderStatus.lastRecordError = null
        runtime.isRecording = true;
        _setRecordAbortTimer();
      });

      recordManager.onError((errMsg) => {
        _clearRecordAbortTimer();
        debugLog("record on error:" + JSON.stringify(errMsg));
        debugLog("last cmd: " + runtime.recorderStatus.lastRecordCmd + " | last event: " + runtime.recorderStatus.lastRecordEvent);
        var isError = true;

        if (runtime.recorderStatus.lastRecordCmd == "START") {
          if (runtime.isRecording || errMsg && errMsg.errMsg == "operateRecorder:fail:audio is recording, don't start record again") {
            isError = false;
            runtime.isRecording = true;
          }
        } else if (runtime.recorderStatus.lastRecordCmd == "STOP") {
          if (!runtime.isRecording || errMsg && errMsg.errMsg == "operateRecorder:fail:audio is stop, don't stop record again") {
            isError = false;
            runtime.isRecording = false;
          }
        }
        if (isError) {
          runtime.isRecording = false;
          runtime.recorderStatus.lastRecordEvent = "ONERROR";
          if (errMsg && errMsg.errMsg) {
            runtime.recorderStatus.lastRecordError = errMsg.errMsg.toString();
          }
        } else {
          _setRecordAbortTimer();
        }

        if (!runtime.isRecording) {
          startRecord({ isOnError: true });
        }
      });

      recordManager.onPause(() => {
        debugLog("on pause");
        _clearRecordAbortTimer();
        if (!runtime.isSuspend) {
          runtime.recorderStatus.lastRecordEvent = "ONPAUSE";
          runtime.recorderStatus.lastRecordError = null;
          runtime.isRecording = false;
          purgeMP3Stream(true);
        }
      });

      recordManager.onResume(() => {
        debugLog("on resume");
        _clearRecordAbortTimer();
        runtime.recorderStatus.lastRecordEvent = "ONRESUME";
        runtime.recorderStatus.lastRecordError = null;
        runtime.isRecording = true;
        _setRecordAbortTimer();
      });

      recordManager.onStop((res) => {
        debugLog("onStop");
        _clearRecordAbortTimer();
        runtime.recorderStatus.lastRecordEvent = "ONSTOP";
        runtime.recorderStatus.lastRecordError = null;

        runtime.isRecording = false;
        purgeMP3Stream();
        //if we stoped, start again
        startRecord({ isOnStop: true });
      });

      recordManager.onFrameRecorded((res) => {
        //debugLog("onFrameRecorded");
        _clearRecordAbortTimer();
        runtime.recorderStatus.lastRecordEvent = "ONFRAME";
        runtime.recorderStatus.lastRecordError = null;

        const { frameBuffer } = res
        const { isLastFrame } = res
        runtime.recorderStatus.lastRAWMP3Frame = frameBuffer;
        runtime.recorderStatus.lastRAWMP3FrameTimeStamp = Date.now();

        setTimeout(function () {
          handleMP3Frame();
          _setRecordAbortTimer();
        }, 1);
      });

      const version = wx.getSystemInfoSync().SDKVersion;
      if (compareVersion(version, '2.3.0') >= 0) {
        recordManager.onInterruptionBegin(() => {
          debugLog("onInterrupt begin");
          onHide();
        });

        recordManager.onInterruptionEnd(() => {
          debugLog("onInterrupt end");
          onShow();
        });
      }
    }

    doStartRecorder(option);
  }

  function findBytes(source, start, range, bytes) {
    var end = start + range;
    if (end > source.length) {
      end = source.length;
    }
    for (var index = start; index < (end - bytes.length); ++index) {
      var match = true;
      for (var index2 = 0; index2 < bytes.length; ++index2) {
        if (source[index + index2] != bytes[index2]) {
          match = false;
          break;
        }
      }
      if (match) {
        return index;
      }
    }
    return -1;
  }

  function findBytesReverse(source, start, range, bytes) {
    var end = start - range;
    if (end > bytes.length) {
      end = bytes.length;
    }
    if ((start + bytes.length) >= source.length) {
      start = source.length - bytes.length - 1;
    }
    for (var index = start; index >= (end - bytes.length); --index) {
      var match = true;
      for (var index2 = 0; index2 < bytes.length; ++index2) {
        if (source[index + index2] != bytes[index2]) {
          match = false;
          break;
        }
      }
      if (match) {
        return index;
      }
    }
    return -1;
  }

  function handleMP3Frame() {
    {
      var newframe = runtime.recorderStatus.lastRAWMP3Frame;
      var timeStamp = runtime.recorderStatus.lastRAWMP3FrameTimeStamp;
      var isLastFrame = false;
      if (!newframe || timeStamp == 0){
        return;
      }
      //debugLog("newframe length: " + newframe.byteLength + " isLastFrame: " + isLastFrame);
      //check length & period
      var length = newframe.byteLength;
      if (length < 22 * 1024) {
        //restart record
        startRecord({ isOnFrame: true });
        return;
      }

      var mp3frame = new Uint8Array(newframe);

      if (!runtime.recorderStatus.lastMP3Head) {
        //if it's not first frame, we don't have chance to extract mp3 header, throw error
        if (runtime.recorderStatus.lastFrameTimeStamp > 0) {
          startRecord({ isOnFrame: true });
          return;
        }
        //try extract mp3 header
        var headMatching = [0xFF, 0xFB, 0xE0, 0xC4];
        var headMatching2 = [0xFF, 0xFB, 0xE2, 0xC4];
        var FFFBE0C4_POS = -1;
        var FFFBE2C4_POS = -1;
        var matchingPos = -1;
        var startPos = 0;
        var stepSize = 1044;
        do {
          matchingPos = findBytes(mp3frame, startPos, stepSize + 10, headMatching);
          if (matchingPos >= 0) {
            FFFBE0C4_POS = matchingPos;
            startPos += stepSize;
          }
        } while (matchingPos >= 0)
        if (FFFBE0C4_POS >= 0) {
          //find next header, then extract delta
          startPos = FFFBE0C4_POS + stepSize;
          FFFBE2C4_POS = findBytes(mp3frame, startPos, stepSize + 10, headMatching2);
          if (FFFBE2C4_POS > FFFBE0C4_POS) {
            // debugLog("found mp3 header");
            runtime.recorderStatus.lastMP3Head = new Uint8Array(newframe, FFFBE0C4_POS, FFFBE2C4_POS - FFFBE0C4_POS);
            runtime.mp3Buffer.set(runtime.recorderStatus.lastMP3Head, 0);
            if (runtime.deviceInfo.platform == "ios") {
              runtime.recorderStatus.lastMP3Frames.push(mp3frame);//push first frame if it's ios
            }
            runtime.recorderStatus.lastFrameTimeStamp = timeStamp;
            if (runtime.recorderStatus.lastRecordCmd == "START" && (!(runtime.success_cb || runtime.fail_cb))) {
              _doPause();
            }
            return;
          } else {
            //we can't extract mp3 header , throw error
            startRecord({ isOnFrame: true });
            return;
          }
        } else {
          //we can't extract mp3 header , throw error
          startRecord({ isOnFrame: true });
          return;
        }
      }
      if (runtime.recorderStatus.lastMP3Head) {
        var oldFrameTimeStamp = runtime.recorderStatus.lastFrameTimeStamp;
        runtime.recorderStatus.lastFrameTimeStamp = timeStamp;
        if (runtime.recorderStatus.lastMP3Frames.length > 0) {
          runtime.recorderStatus.lastFrameTimePeriod = timeStamp - oldFrameTimeStamp;
          if (runtime.recorderStatus.lastFrameTimePeriod < 300 || runtime.recorderStatus.lastFrameTimePeriod > 700) {
            debugLog("too short or too long period: " + runtime.recorderStatus.lastFrameTimePeriod + " size: " + mp3frame.length);
            purgeMP3Stream(true);
            return;//too short period, not valid
          }
        }

        runtime.recorderStatus.lastMP3Frames.push(mp3frame);

        if (runtime.recorderStatus.lastMP3Frames.length >= 2) {
          //there's enough frames
          runtime.recorderStatus.lastValidFrameTimeStamp = timeStamp;
          if (runtime.success_cb || runtime.fail_cb) {
            // debugLog("frames enough, do detect");
            reDoCheck();
          }
          if (runtime.recorderStatus.lastMP3Frames.length > 2) {
            runtime.recorderStatus.lastMP3Frames.shift();
          }
        }
      }
    }
  }

  function purgeMP3Stream(onlyLastMP3Frames) {
    // debugLog("purgeMP3: " + onlyLastMP3Frames);
    runtime.recorderStatus.lastRAWMP3Frame = null;
    runtime.recorderStatus.lastRAWMP3FrameTimeStamp = 0;
    runtime.recorderStatus.lastMP3Frames = [];
    runtime.recorderStatus.lastValidFrameTimeStamp = 0;
    runtime.recorderStatus.lastFrameTimePeriod = 0;
    if (onlyLastMP3Frames) {
      return;
    }
    runtime.recorderStatus.lastFrameTimeStamp = 0;
    runtime.recorderStatus.lastMP3Head = null;

  }

  function getMP3Stream(onlyCheck) {
    var mp3BufferStart = runtime.recorderStatus.lastMP3Head.length;
    //find first frame position
    var headMatching2 = [0xFF, 0xFB, 0xE2, 0xC4];
    var firstFrame = runtime.recorderStatus.lastMP3Frames[0];
    var secondFrame = runtime.recorderStatus.lastMP3Frames[1];
    var matchingPos = findBytes(firstFrame, 0, 1045 * 3, headMatching2);
    var matchingPos2 = findBytesReverse(secondFrame, secondFrame.length - 1, 1045, headMatching2);
    // debugLog("pos1 "+ matchingPos + " | pos2 " + matchingPos2);
    if (matchingPos < 0 || matchingPos2 < 0) {
      return null;
    }
    if (onlyCheck) {
      return true;
    }
    //copy first frame till end
    var frameCopySize = firstFrame.length - matchingPos;
    runtime.mp3Buffer.set(firstFrame.slice(matchingPos), mp3BufferStart);
    mp3BufferStart += frameCopySize;
    //copy second frame till frame end
    frameCopySize = matchingPos2;
    runtime.mp3Buffer.set(secondFrame.slice(0, matchingPos2), mp3BufferStart);
    mp3BufferStart += frameCopySize;
    // debugLog("total mp3 size: " + mp3BufferStart);
    return runtime.mp3Buffer.slice(0, mp3BufferStart).buffer;
  }

  function doStartRecorder(option) {
    //each time do sort 
    if (runtime.checkFormatData.length > 1) {
      runtime.checkFormatData.sort(compareRecordConfig);
      debugLog("sort config: " + JSON.stringify(runtime.checkFormatData));
    }
    var start = false;
    var stop = false;
    var resume = false;

    if (runtime.recorderStatus.lastRecordCmd == "START" && (runtime.recorderStatus.lastRecordEvent == "" || runtime.recorderStatus.lastRecordEvent == "ONSTART")) {
      //if time is too long, that's something wrong
      if ((runtime.recorderStatus.lastRecordTime > 0) && (Date.now() - runtime.recorderStatus.lastRecordTime) > 2000) {
        stop = true;
      }
    } else if (runtime.recorderStatus.lastRecordEvent == "ONSTART" || runtime.recorderStatus.lastRecordEvent == "ONFRAME") {
      //if it's already started, do nothing
    } else if (runtime.recorderStatus.lastRecordEvent == "" || runtime.recorderStatus.lastRecordEvent == "ONSTOP") {
      start = true;
    } else if (runtime.recorderStatus.lastRecordEvent == "ONPAUSE") {
      if (runtime.deviceInfo.platform == "android" && runtime.recorderStatus.lastRecordSource != "" && runtime.recorderStatus.lastRecordSource != runtime.checkFormatData[0].src) {
        //if change audio src, restart record
        stop = true;
      } else {
        resume = true;
      }
    } else if (runtime.recorderStatus.lastRecordEvent == "ONINTERRUPT") {
      stop = true;
    } else if (runtime.recorderStatus.lastRecordEvent == "ONERROR") {
      //if there is error, we will try stop/start recorder every 1000ms
      if (runtime.recorderStatus.lastRecordError) {
        runtime.recorderStatus.lastRecordError = null;
        setTimeout(function () {
          if (runtime.recorderStatus.lastRecordCmd == "STOP") {
            _doStart(true);
          } else {
            _doStop(true);
          }
        }, 2000);
      }
    }

    runtime.record_options.audioSource = runtime.checkFormatData[0].src;
    runtime.recorderStatus.lastRecordSource = runtime.record_options.audioSource;
    debugLog("doStartRecorder: " + runtime.record_options.audioSource + " : " + runtime.record_options.duration + " : " + runtime.recorderStatus.lastRecordEvent);

    if (start) {
      _doStart();
    } else if (stop) {
      _doStop();
    } else if (resume) {
      _doResume();
    }
  }

  function _clearRecordAbortTimer() {
    if (runtime.recordAbortTimer != null) {
      clearTimeout(runtime.recordAbortTimer);
      runtime.recordAbortTimer = null;
    }
  }

  function _setRecordAbortTimer() {
    _clearRecordAbortTimer();
    runtime.recordAbortTimer = setTimeout(function () {
      if (runtime.recorderStatus.lastRecordCmd == "STOP") {
        _doStart();
      } else {
        _doStop();
      }
    }, 1000);
  }

  function _doStart(isOnError) {
    if (!runtime.isRecording || isOnError) {
      debugLog("_doStart");
      runtime.recorderStatus.lastRecordTime = Date.now();
      runtime.recorderStatus.lastRecordCmd = "START";
      runtime.recorderStatus.lastRecordEvent = "";
      _setRecordAbortTimer();
      wx.getRecorderManager().start(runtime.record_options);
    }
  }

  function _doStop(isOnError) {
    if (runtime.isRecording || isOnError || runtime.recorderStatus.lastRecordEvent == "ONPAUSE" || runtime.recorderStatus.lastRecordEvent == "ONINTERRUPT") {
      debugLog("_doStop");
      runtime.recorderStatus.lastRecordCmd = "STOP";
      runtime.recorderStatus.lastRecordEvent = "";
      runtime.recorderStatus.lastRecordTime = 0;
      _setRecordAbortTimer();
      wx.getRecorderManager().stop();
    }
  }

  function _doResume(isOnError) {
    if (!runtime.isRecording || isOnError) {
      debugLog("_doResume");
      runtime.recorderStatus.lastRecordTime = Date.now();
      runtime.recorderStatus.lastRecordCmd = "RESUME";
      runtime.recorderStatus.lastRecordEvent = "";
      _setRecordAbortTimer();
      wx.getRecorderManager().resume();
    }
  }

  function _doPause(isOnError) {
    if (runtime.isRecording || isOnError) {
      debugLog("_doPause");
      runtime.recorderStatus.lastRecordCmd = "PAUSE";
      runtime.recorderStatus.lastRecordEvent = "";
      _setRecordAbortTimer();
      wx.getRecorderManager().pause();
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

    var info = runtime.recorderStatus.lastRecordSource + "_" + runtime.recorderStatus.lastFrameTimePeriod;

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

    var mp3Stream = getMP3Stream();
    if (!mp3Stream) {
      debugLog("doDetect error: can't get mp3 stream");
      clearAbortTimer();
      setTimeout(function () {
        runtime.resultUrl = "ERROR_SERVER";
        reDoCheck();
      });
      return;
    }

    clearAbortTimer();
    runtime.isDetecting = true;

    var query = "?cmd=" + encodeURIComponent(cmd);

    runtime.requestTask = wx.request({
      url: config.apiServer + "api/decode2" + query,
      data: mp3Stream,
      method: "POST",
      header: {
        "content-type": "audio/mpeg"
      },
      dataType: "json",
      success: function (res) {
        runtime.hasInitConnection = true;
        if (!runtime.isDetecting)
          return;
        clearAbortTimer();
        runtime.isDetecting = false;
        runtime.requestTask = null;
        if (res.statusCode != 200 && runtime.resultUrl == '') {
          runtime.resultUrl = "ERROR_SERVER";
          reDoCheck();
          return;
        }

        try {
          const data = res.data
          if (!data) {
            runtime.resultUrl = "ERROR_SERVER";
            reDoCheck();
            return;
          }
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
        } catch (e) {
          runtime.resultUrl = "ERROR_SERVER";
          reDoCheck();
          return;
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