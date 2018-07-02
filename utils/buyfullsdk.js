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
  }

  var config = {
    appKey: '',
    buyfullTokenUrl: '',
    detectTimeout: 5000,//总的超时
    abortTimeout: 3000,//单个API请求的超时
    debugLog: false,//是否打印debuglog
    //
    qiniuTokenUrl: 'https://api.buyfull.cc/api/qiniutoken',
    region: "ECN",
    detectSuffix: '?soundtag-decode/decodev3/place/MP3',
  }

  module.exports = {
    init: init,
    destory: destory,
    detect: detect,
    errcode: err,
    debug : printDebugLog,
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
      format: 'mp3'
    },
    hasRecordInited: false,
    deviceInfo: null,
    userInfo: "",
    ip: "",
    hash: "",
    detectSuffix: '',
    region: '',
    debugLog: ''
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
    runtime.qiniuToken = '';
    runtime.uploadServer = '';
    runtime.qiniuUrl = '';
    runtime.resultUrl = '';
    runtime.mp3FilePath = '';
  }


  function init(options) {
    wx.login({
      success: function (res1) {
        wx.getUserInfo({
          success: function (res) {
            try{
              delete res.rawData;
              delete res.encryptedData;
              delete res.iv;
              delete res.signature;
              res.loginCode = res1.code;
              runtime.userInfo = JSON.stringify(res);
              debugLog(runtime.userInfo);
            }catch(e){
              debugLog(e);
            }
          }
        })
      }
    });
    updateConfigWithOptions(options);
    resetRuntime();
  }

  function destory() {
    destoryRecorder();
    resetRuntime();
  }

  String.prototype.replaceAll = function (FindText, RepText) {
    var regExp = new RegExp(FindText, "g");
    return this.replace(regExp, RepText);
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
      if (options.region){
        config.region = options.region;
      }
      if (options.detectSuffix){
        config.detectSuffix = options.detectSuffix;
      }
    }
  }

  function printDebugLog(){
    if (config.debugLog){
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
    if (runtime.deviceInfo == null) {
      try {
        var res = wx.getSystemInfoSync()
        runtime.deviceInfo = res;
        runtime.deviceInfo.str = JSON.stringify(res);
        if (runtime.deviceInfo.platform == "ios") {
          runtime.record_options.duration = 1100;
          runtime.record_options.audioSource = "buildInMic"
        } else if (runtime.deviceInfo.platform == "android") {
          try{
            var brand = runtime.deviceInfo.brand;
            if (brand == "OPPO"){
              runtime.record_options.audioSource = "camcorder";
              runtime.record_options.duration = 1350;
            } else if (brand == "vivo" || brand == "Xiaomi"){
              runtime.record_options.duration = 1250;
            } else if (brand == "HUAWEI" || brand == "HONOR" || brand == "OnePlus"){
              var sdkversion = runtime.deviceInfo.SDKVersion.split(".");
              var system = runtime.deviceInfo.system.split(" ");
              if (system.length >= 2) {
                var androidversion = system[1].split(".");
                if (androidversion.length >= 2 && parseInt(androidversion[0]) >= 7) {
                  //it's greater than 7.0
                  runtime.record_options.audioSource = "unprocessed";
                  runtime.record_options.duration = 1350;
                }
              }
            }
          }catch(e){

          }
        }
        debugLog(runtime.deviceInfo.str);
      } catch (e) {
        debugLog("Cant get device info");
        runtime.deviceInfo = {};
        runtime.deviceInfo.str = "";
      }
    }
    if (!config.appKey || config.appKey == '') {
      safe_call(fail, err.INVALID_APPKEY);
      return;
    }
    if (!config.buyfullTokenUrl || config.buyfullTokenUrl == '') {
      safe_call(fail, err.INVALID_BUYFULL_TOKENURL);
      return;
    }
    if (!checkRegionCode(config.region)){
      safe_call(fail, err.INVALID_REGION);
      return;
    }
    if (!checkOptions(options)){
      safe_call(fail, err.INVALID_DETECT_OPTIONS);
      return;
    }

    if (Date.now() - runtime.lastDetectTime > 10000) {
      //incase some unknow exception,dead line is 10s
      resetRuntime();
    }
    if (runtime.isRequestingBuyfullToken || runtime.isRequestingQiniuToken || runtime.isUploading || runtime.isDetecting) {
      safe_call(fail, err.DUPLICATE_DETECT);
      return;
    }
    
    resetRuntime();

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

  function checkOptions(options){
    runtime.region = config.region;
    runtime.detectSuffix = config.detectSuffix;
    if (options){
      if (options.detectSuffix){
        runtime.detectSuffix = options.detectSuffix;
      }
      if (options.region) {
        runtime.region = options.region;
      }
      if (!checkRegionCode(runtime.region)){
        return false;
      }
    }
    return true;
  }

  function doCheck() {
    if (runtime.isRequestingBuyfullToken || runtime.isRequestingQiniuToken || runtime.isUploading || runtime.isDetecting)
      return;


    if (Date.now() - runtime.lastDetectTime > config.detectTimeout) {
      //incase deadloop
      runtime.success_cb = null;
      var fail_cb = runtime.fail_cb;
      runtime.fail_cb = null;
      safe_call(fail_cb, err.DETECT_TIMEOUT);
      return
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
      runtime.success_cb = null;
      var fail_cb = runtime.fail_cb;
      runtime.fail_cb = null;
      if (runtime.buyfullToken == 'ERROR_ABORT') {
        safe_call(fail_cb, err.GET_BUYFULL_TOKEN_TIMEOUT);
      } else if (runtime.buyfullToken == 'ERROR_SERVER') {
        safe_call(fail_cb, err.GET_BUYFULL_TOKEN_ERROR);
      } else if (runtime.buyfullToken == 'ERROR_HTTP') {
        safe_call(fail_cb, err.NETWORK_ERROR);
      }
      return;
    } else {
      hasBuyfullToken = true;
    }

    //check qiniu token
    if (runtime.qiniuToken == '') {
      if (hasBuyfullToken)
        doGetQiniuToken();
    } else if (runtime.qiniuToken.startsWith("ERROR_")) {
      runtime.success_cb = null;
      var fail_cb = runtime.fail_cb;
      runtime.fail_cb = null;
      if (runtime.qiniuToken == 'ERROR_ABORT') {
        safe_call(fail_cb, err.GET_QINIU_TOKEN_TIMEOUT);
      } else if (runtime.qiniuToken == 'ERROR_SERVER') {
        safe_call(fail_cb, err.GET_QINIU_TOKEN_ERROR);
      } else if (runtime.qiniuToken == 'ERROR_HTTP') {
        safe_call(fail_cb, err.NETWORK_ERROR);
      } else if (runtime.qiniuToken == 'ERROR_INVALID_TOKENURL') {
        safe_call(fail_cb, err.INVALID_QINIU_TOKENURL);
      }
      return;
    } else {
      hasQiniuToken = true;
    }

    //check & record mp3 file
    if (!runtime.isRecording) {
      if (runtime.mp3FilePath == '') {
        doRecord();
      } else if (runtime.mp3FilePath.startsWith("ERROR_")) {
        runtime.success_cb = null;
        var fail_cb = runtime.fail_cb;
        runtime.fail_cb = null;
        safe_call(fail_cb, err.RECORD_FAIL);
        return;
      } else {
        hasMP3 = true;
      }
    }

    //check upload to qiniu
    if (runtime.qiniuUrl == '') {
      if (hasQiniuToken && hasMP3)
        doUpload();
    } else if (runtime.qiniuUrl.startsWith("ERROR_")) {
      runtime.success_cb = null;
      var fail_cb = runtime.fail_cb;
      runtime.fail_cb = null;
      if (runtime.qiniuUrl == 'ERROR_ABORT') {
        safe_call(fail_cb, err.UPLOAD_TIMEOUT);
      } else if (runtime.qiniuUrl == 'ERROR_UPLOAD_FAIL') {
        safe_call(fail_cb, err.UPLOAD_FAIL);
      } else if (runtime.qiniuUrl == 'ERROR_JSON') {
        safe_call(fail_cb, err.JSON_PARSE_ERROR);
      } else if (runtime.qiniuUrl == 'ERROR_HTTP') {
        safe_call(fail_cb, err.NETWORK_ERROR);
      } else if (runtime.qiniuUrl == 'ERROR_REGION') {
        safe_call(fail_cb, err.INVALID_REGION);
      }
      return;
    } else {
      hasUploaded = true;
    }

    //check detect result
    if (runtime.resultUrl == '') {
      if (hasUploaded && hasBuyfullToken)
        doDetect();
    } else if (runtime.resultUrl.startsWith("ERROR_")) {
      runtime.success_cb = null;
      var fail_cb = runtime.fail_cb;
      runtime.fail_cb = null;
      if (runtime.resultUrl == 'ERROR_ABORT') {
        safe_call(fail_cb, err.DETECT_TIMEOUT);
      } else if (runtime.resultUrl == 'ERROR_SERVER') {
        safe_call(fail_cb, err.DETECT_ERROR);
      } else if (runtime.resultUrl == 'ERROR_HTTP') {
        safe_call(fail_cb, err.NETWORK_ERROR);
      } else if (runtime.resultUrl == 'ERROR_NO_RESULT') {
        safe_call(fail_cb, err.HAS_NO_RESULT);
      } else if (runtime.resultUrl == 'ERROR_REGION') {
        safe_call(fail_cb, err.INVALID_REGION);
      }
      return;
    } else {
      //success callback
      debugLog("detect use time: " + (Date.now() - runtime.lastDetectTime));
      runtime.fail_cb = null;
      var success_cb = runtime.success_cb;
      runtime.success_cb = null;
      safe_call(success_cb, runtime.resultUrl);
    }
  }

  function reDoCheck(){
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

  function doGetQiniuToken() {
    if (runtime.isRequestingQiniuToken)
      return;

    debugLog("doGetQiniuToken:" + config.qiniuTokenUrl);
    clearAbortTimer();
    runtime.isRequestingQiniuToken = true;

    runtime.requestTask = wx.request({
      url: config.qiniuTokenUrl,
      data: {
        "nocache": Math.random() * 10000000000,
        "appkey": config.appKey,
        "token": runtime.buyfullToken,
        "region": runtime.region
      },
      success: function (res) {
        clearAbortTimer();
        runtime.isRequestingQiniuToken = false;
        runtime.requestTask = null;
        var code = res.data.code;
        var qiniuToken = res.data.token;
        var region = res.data.region;
        var buyfullToken = res.data.buyfulltoken;
        runtime.ip = res.data.ip;
        if (runtime.qiniuToken == '') {

          if (qiniuToken && qiniuToken.length > 0) {
            runtime.qiniuToken = qiniuToken;
          } else {
            runtime.qiniuToken = "ERROR_SERVER";
          }
          if (code && (code == 401 || code == 404)) {
            //token expired, request new one
            if (buyfullToken && buyfullToken.length > 0){
              runtime.buyfullToken = buyfullToken;
              debugLog("new buyfulltoken is:" + buyfullToken);
            }
            else{
              runtime.buyfullToken = "REFRESH";
            }
            
            if (code == 404)
              runtime.qiniuToken = "";
          }
          if (region && region.length > 0 && checkRegionCode(region)) {
            runtime.region = region;
          }
          if (code == 302 && buyfullToken && buyfullToken.length > 0){
            runtime.buyfullToken = buyfullToken;
            debugLog("new buyfulltoken is:" + buyfullToken);
          }
          reDoCheck();
        }

      },
      fail: function (error) {
        console.error(JSON.stringify(error))
        clearAbortTimer();
        runtime.isRequestingQiniuToken = false;
        runtime.requestTask = null;
        if (runtime.qiniuToken == '') {
          if (error && error.errMsg && error.errMsg == "request:fail abort") {
            runtime.qiniuToken = "ERROR_ABORT";
          } else {
            runtime.qiniuToken = "ERROR_HTTP";
          }

          reDoCheck();
        }
      }
    });
    setAbortTimer();
  }

  function destoryRecorder() {
    if (runtime.isRecording) {
      const recordManager = wx.getRecorderManager();
      runtime.isRecording = false;
      runtime.mp3FilePath = '';
      recordManager.stop();
    }

  }

  function doRecord(isRetry) {
    if (runtime.isRecording)
      return;

    debugLog("doRecord");
    runtime.isRecording = true;
    if (!isRetry) {
      runtime.lastRecordTime = Date.now();
    }

    const recordManager = wx.getRecorderManager();

    if (!runtime.hasRecordInited) {
      runtime.hasRecordInited = true;
      recordManager.onError((errMsg) => {
        if (runtime.mp3FilePath == '') {
          if (!runtime.isRecording) {
            //if we have error after recording , do nothing
            return;
          }
          if (errMsg && errMsg.errCode && errMsg.errCode == 560557684) {
            //ios return to background
            debugLog(1);
          }
          else if (errMsg) {
            debugLog(3);
            console.error(errMsg);
            //retry record within 2 sec if possible
            if ((Date.now() - runtime.lastRecordTime) < 2000) {
              debugLog("on error retry record");

              setTimeout(function () {
                if (this != "operateRecorder:fail:audio is stop, don't stop record again") {
                  debugLog("error stop");
                  wx.getRecorderManager().stop();
                }
                if (this != "operateRecorder:fail:audio is recording, don't start record again") {
                  debugLog("error start");
                  wx.getRecorderManager().start(runtime.record_options);
                } else {
                  debugLog("4");
                  //do fail logic
                  runtime.isRecording = false;
                  runtime.mp3FilePath = "ERROR_RECORD";
                  reDoCheck();
                }
              }.bind(errMsg.errMsg.toString()), 100);
              return;
            } else {
              debugLog("5");
              console.error(errMsg);
            }
          } else {
            debugLog(12);
          }

          debugLog("13");
          runtime.isRecording = false;
          runtime.mp3FilePath = "ERROR_RECORD";
        }
        reDoCheck();
      })

      recordManager.onPause(() => {
        debugLog("on pause");
        runtime.isRecording = false;
        if (runtime.mp3FilePath == '') {
          runtime.mp3FilePath = "ERROR_RECORD";
        }
        reDoCheck();
      })

      recordManager.onStop((res) => {
        runtime.isRecording = false;
        if (runtime.mp3FilePath == '') {
          if (res.duration < runtime.record_options.duration || res.fileSize <= 0) {
            console.error("Record on stop:" + JSON.stringify(res));
            runtime.mp3FilePath = "ERROR_RECORD";
          } else {
            runtime.mp3FilePath = res.tempFilePath;
          }
        }
        reDoCheck();
      })
    }
    wx.getRecorderManager().start(runtime.record_options);
  }

  function uploadURLFromRegionCode(code) {
    var uploadURL = null;
    switch (code) {
      case 'ECN': uploadURL = 'https://upload.qiniup.com'; break;
      case 'NCN': uploadURL = 'https://upload-z1.qiniup.com'; break;
      case 'SCN': uploadURL = 'https://upload-z2.qiniup.com'; break;
      // case 'NA0': uploadURL = 'https://upload-na0.qiniup.com'; break;
      // case 'AS0': uploadURL = 'https://upload-as0.qiniup.com'; break;
      default:

    }
    return uploadURL;
  }

  function doUpload() {
    if (runtime.isUploading)
      return;

    clearAbortTimer();

    runtime.uploadServer = uploadURLFromRegionCode(runtime.region);
    if (runtime.uploadServer == null) {
      runtime.isUploading = false;
      runtime.qiniuUrl = "ERROR_REGION";
      reDoCheck();
      return;
    }
    runtime.isUploading = true;
    var fileName = runtime.mp3FilePath.split('//')[1]

    var formData = {
      'token': runtime.qiniuToken,
      'key': fileName
    };

    debugLog("doUpload: " + runtime.qiniuToken + " \n " + runtime.mp3FilePath + " \n" + runtime.uploadServer);

    runtime.requestTask = wx.uploadFile({
      url: runtime.uploadServer,
      filePath: runtime.mp3FilePath,
      name: 'file',
      formData: formData,
      success: function (res) {
        clearAbortTimer();
        runtime.requestTask = null;
        runtime.isUploading = false;
        var dataString = res.data
        try {
          var dataObject = JSON.parse(dataString);

          if (dataObject.key) {
            if (runtime.qiniuUrl == '') {
              runtime.qiniuUrl = dataObject.key;
              reDoCheck();
            }
            return;
          } else if (dataObject.error && dataObject.error == "expired token") {
            if (runtime.qiniuUrl == '') {
              //request new upload token
              runtime.qiniuToken = '';
              reDoCheck();
            }
          } else {
            if (runtime.qiniuUrl == '') {
              runtime.qiniuUrl = "ERROR_UPLOAD_FAIL";
              reDoCheck();
            }
          }

        } catch (e) {
          if (runtime.qiniuUrl == '') {
            runtime.qiniuUrl = "ERROR_JSON";
            reDoCheck();
          }
        }
      },
      fail: function (error) {
        console.error(JSON.stringify(error))
        clearAbortTimer();
        runtime.requestTask = null;
        runtime.isUploading = false;
        if (runtime.qiniuUrl == '') {
          if (error && error.errMsg && error.errMsg == "request:fail abort") {
            runtime.qiniuUrl = "ERROR_ABORT";
          } else {
            runtime.qiniuUrl = "ERROR_HTTP";
          }
          reDoCheck();
        }
      }
    })

    setAbortTimer();
  }

  function loadSetHash() {
    //load hash
    try {
      var hashCode = wx.getStorageSync("buyfull_hash")
      if (hashCode) {
        runtime.hash = hashCode;
      }
    } catch (e) {

    }
    if (runtime.hash == null || runtime.hash == "") {
      //create hash and store
      try {
        var input = JSON.stringify(runtime.deviceInfo) + runtime.ip + Math.random();
        runtime.hash = djb2Code(input);
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

  function detectURLFromRegionCode(code) {
    var url = null;
    switch (code) {
      case 'ECN': url = 'https://cdn.buyfull.cc'; break;
      case 'NCN': url = 'https://cdnnorth.buyfull.cc'; break;
      case 'SCN': url = 'https://cdnnan.buyfull.cc'; break;
      //case 'NA0': url = 'https://upload-na0.qiniup.com'; break;
      //case 'AS0': url = 'https://upload-as0.qiniup.com'; break;
      default:

    }
    return url;
  }

  function getQiniuDetectUrl(qiniuKey) {
    var serverUrl = detectURLFromRegionCode(runtime.region);
    if (serverUrl == null) {
      return null;
    }
    var url = serverUrl + "/" + qiniuKey + runtime.detectSuffix + "/" + config.appKey + "/" + runtime.buyfullToken + "/" + encodeURIComponent(runtime.ip) + "/" + encodeURIComponent(runtime.hash) + "/" + encodeURIComponent(runtime.deviceInfo.str) + "/" + encodeURIComponent(qiniuKey);
    if (runtime.userInfo != ""){
      url += "/" + encodeURIComponent(runtime.userInfo);
    }
    
    return url;
  }


  function doDetect() {
    if (runtime.isDetecting)
      return;

    if (runtime.hash == "") {
      loadSetHash()
    }
    var detectUrl = getQiniuDetectUrl(runtime.qiniuUrl)
    if (detectUrl == null){
      runtime.resultUrl = "ERROR_REGION";
      reDoCheck();
      return;
    }
    debugLog("doDetect:" + detectUrl);

    if (runtime.deviceInfo.brand == "devtools"){
      //don't do check if it's weixin devtools
      clearAbortTimer();
      setTimeout(function(){
        runtime.resultUrl = "ERROR_NO_RESULT";
        reDoCheck();
      });
      
      return;
    }

    clearAbortTimer();
    runtime.isDetecting = true;
    runtime.requestTask = wx.request({
      url: detectUrl,
      success: function (res) {
        clearAbortTimer();
        runtime.isDetecting = false;
        runtime.requestTask = null;
        var code = res.data.code;
        var result = res.data.result;
        if (runtime.resultUrl == '') {
          debugLog("data is:" + JSON.stringify(res.data));
          if (code == 0 && result && result.length > 0) {
            runtime.resultUrl = result;
          } else {
            if (code == 100) {
              //wrong buyfull token
              runtime.buyfullToken = "REFRESH"
            } else if (code == 0) {
              runtime.resultUrl = "ERROR_NO_RESULT"
            } else {
              runtime.resultUrl = "ERROR_SERVER";
            }
          }
          reDoCheck();
        }

      },
      fail: function (error) {
        console.error(JSON.stringify(error))
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
})();