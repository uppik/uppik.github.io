'use strict;';

var Uppik = function(target, options) {
    if (!(target instanceof HTMLElement)) {
        target = document.getElementById(target);
    }
    this.target = target;
    this.options = {
        showState: true,
        onSuccess: this.onSuccess,
        onUpload: this.onUpload,
        onError: this.onError
    };
    if (options) {
        for (key in options) {
            this.options[key] = options[key];
        }
    }
    this.currentFile = null;
    this.tryTime = 0;
    this.token = '';
    this.endpoint = '';
    this.quality = 0.5;
    this.fadeoutMessageInterval = null;
    this.hideMessageInterval = null;
    this.msgContainer = null;
    this.msgBody = null;

    //multiple file upload
    this.currentFileIndex = 1;
    this.totalFile = 1;

    this.init();
}

Uppik.inquiryUrl = 'http://www.uppik.net/api/inquiry';
Uppik.maxSize = 1024;
Uppik.messageTTL = 5000;
Uppik.maxTry = 10;
Uppik.allowedMimes = ["image/gif", "image/jpeg", "image/png", "image/jpg",];

Uppik.parseJson = function(str) {
    var output = {};
    try {
        output = JSON.parse(str);
    } catch (ex) {
        //nothing
    }
    return output;
}

Uppik.prototype.init = function() {
    this.initMessage();
    if (!this.checkRequirement()) {
        this.disableUpload();
        return;
    }
    this.initElements();
    this.inquiry();
}

Uppik.prototype.initMessage = function() {
    //message container
    var msgContainer = document.createElement('div');
    msgContainer.style.position = 'fixed';
    msgContainer.style.top = 0;
    msgContainer.style.left = 0;
    msgContainer.style.width = '100%';
    msgContainer.style.display = 'none';
    msgContainer.style.textAlign = 'center';
    msgContainer.style.backgroundColor = 'transparent';
    msgContainer.style.transition = 'opacity 0.5s ease';
    this.msgContainer = msgContainer;

    //message body
    var msgBody = document.createElement('span');
    msgBody.style.display = 'inline-block';
    msgBody.style.padding = '0.5em 1.5em';
    msgBody.style.marginTop = '0.5em';
    msgBody.style.borderRadius = '1em';
    msgBody.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    this.msgBody = msgBody;

    msgContainer.appendChild(msgBody);
    document.body.appendChild(msgContainer);
}

Uppik.prototype.initElements = function() {
    this.target.style.position = 'relative';
    this.target.style.overflow = 'hidden';

    // file input element
    var input = document.createElement('input');
    input.type = 'file';
    input.style.width = '1000px';
    input.style.height = '1000px';
    input.style.fontSize = '1000px';
    input.style.opacity = 0;
    input.style.position = 'absolute';
    input.style.left = '0px';
    input.style.top = '0px';
    input.style.cursor = 'pointer';
    this.input = input;

    //attack file input to body
    this.target.appendChild(input);

    //bind events
    var me = this;
    input.onchange = function(e) {
        e.stopPropagation();
        me.onFileSelected(e);
    }
}

Uppik.prototype.disableUpload = function() {
    var me = this;
    this.target.onclick = function (e) {
        e.preventDefault();
        me.showMessage('This browser is not supported, lets switch to a modern browser.', true);
    }
}

Uppik.prototype.showMessage = function(msg, isError, keepShow) {
    if (this.fadeoutMessageInterval) {
        clearInterval(this.fadeoutMessageInterval);
        this.fadeoutMessageInterval = null;
    }
    if (this.hideMessageInterval) {
        clearInterval(this.hideMessageInterval);
        this.hideMessageInterval = null;
    }
    this.msgBody.innerText = msg;
    if (isError) {
        this.msgBody.style.color = '#ff0000';
    } else {
        this.msgBody.style.color = '#00ff00';
    }
    this.msgContainer.style.opacity = 1;
    this.msgContainer.style.display = 'block';
    var me = this;
    if (keepShow) {
        return;
    }
    this.hideMessageInterval = setInterval(function() {
        me.hideMessage();
    }, Uppik.messageTTL);
}

Uppik.prototype.hideMessage = function() {
    if (this.hideMessageInterval) {
        clearInterval(this.hideMessageInterval);
        this.hideMessageInterval = null;
    }
    this.msgContainer.style.opacity = 0;
    var me = this;
    this.fadeoutMessageInterval = setInterval(function() {
        me.msgContainer.style.display = 'none';
        if (me.fadeoutMessageInterval) {
            clearInterval(me.fadeoutMessageInterval);
            me.fadeoutMessageInterval = null;
        }
    }, 500);
}

Uppik.prototype._onSuccess = function(image) {
    this.input.value = null;
    this.input.removeAttribute('disabled');
    this.options.onSuccess.apply(this, [image.url, image]);
}

Uppik.prototype._onUpload = function() {
    this.input.disabled = true;
    if (this.options.showState) {
        this.showMessage('Uploading...', false, true)
    }
    this.options.onUpload.apply(this, [this.currentFileIndex, this.totalFile]);
}

Uppik.prototype._onError = function(error) {
    this.input.value = null;
    this.input.removeAttribute('disabled');
    if (this.options.showState) {
        this.showMessage(error, true);
    }
    this.options.onError.apply(this, [error]);
}

Uppik.prototype.onFileSelected = function(event) {
    this.loadImage(event.target.files[0]);
}

Uppik.prototype.onSuccess = function(url, image) {
    console.log(image);
}

Uppik.prototype.onUpload = function(index, total) {
    console.log('Uploading...');
}

Uppik.prototype.onError = function(error) {
    console.log(error);
}

Uppik.prototype.inquiry = function() {
    var req = new XMLHttpRequest();
    var me = this;
    if ('withCredentials' in req) {
        req.open('GET', Uppik.inquiryUrl, true);
        req.onreadystatechange = function() {
            if (req.readyState === 4) {
                if (req.status >= 200 && req.status < 400) {
                    var data = Uppik.parseJson(req.responseText);
                    if (data.endpoint) {
                        me.endpoint = data.endpoint;
                        me.token = data.token;
                        me.quality = data.quality;
                        return;
                    }
                }
                me.showMessage('Cannot get information from server. Please try later.', true);
            }
        };
        req.send();
    }
}

Uppik.prototype.upload = function(data) {
    if (this.token == '' || this.enpoint == '') {
        return;
    }
    var req = new XMLHttpRequest();
    var me = this;
    if ('withCredentials' in req) {
        req.open('POST', this.endpoint + '/upload', true);
        req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        req.onreadystatechange = function() {
            if (req.readyState === 4) {
                if (req.status >= 200 && req.status < 400) {
                    var res = Uppik.parseJson(req.responseText);
                    if(res.image) {
                        //synchronous upload return url immediately
                        me._onSuccess(res.image);
                        return;
                    }
                    if (res.id) {
                        // asynchronous upload return file id
                        me.tryTime = 0;
                        me.currentFile = res.id;
                        me.delayQueryStatus();
                        return;
                    }
                }
                me._onError('Upload failed, please try again later.');
            }
        };
        this.hideMessage();
        req.send('token=' + this.token + '&data=' + encodeURI(data));
        this._onUpload();
    }
}

Uppik.prototype.checkRequirement = function() {
    if (typeof window.URL === 'undefined') {
        return false;
    }
    return true;
}

Uppik.prototype.queryStatus = function() {
    if (this.token == '' || this.endpoint == '') {
        return;
    }
    var req = new XMLHttpRequest();
    var me = this;
    if ('withCredentials' in req) {
        req.open('GET', this.endpoint + '/status?id=' + this.currentFile + '&token=' + this.token, true);
        req.onreadystatechange = function () {
            if (req.readyState === 4) {
                if (req.status >= 200 && req.status < 400) {
                    var res = Uppik.parseJson(req.responseText);
                    if (res.status == 'success') {
                        me._onSuccess(res.image);
                        return;
                    }
                    if (res.status == 'failed') {
                        me.showMessage(res.error, true);
                        return;
                    }
                }
                //error or pending
                me.tryTime++;
                if (me.tryTime < Uppik.maxTry) {
                    me.delayQueryStatus();
                } else {
                    me._onError('Upload timeout, please try again.');
                }
            }
        }
        req.send();
    }
}

Uppik.prototype.delayQueryStatus = function() {
    var me = this;
    setTimeout(function() {
        me.queryStatus()
    }, 1000);
}

Uppik.prototype.loadImage = function(file) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    var me = this;
    if (Uppik.allowedMimes.indexOf(file.type) == -1) {
        return;
    }
    img.onload = function() {
        URL.revokeObjectURL(url);
        var imgWidth = img.width;
        var imgHeight = img.height;
        var newX = imgWidth;
        var newY = imgHeight;
        if (imgWidth > imgHeight) {
            if (imgWidth > Uppik.maxSize) {
                newX = Uppik.maxSize;
                newY = (Uppik.maxSize * imgHeight) / imgWidth;
            }
        } else {
            if (imgHeight > Uppik.maxSize) {
                newX = (Uppik.maxSize * imgWidth) / imgHeight;
                newY = Uppik.maxSize;
            }
        }
        var canvas = me.getCanvas();
        canvas.width = newX;
        canvas.height = newY;
        canvas.getContext("2d").drawImage(img, 0, 0, newX, newY);
        //finally upload data
        var raw = canvas.toDataURL('image/jpeg', me.quality);
        var imgData = raw.replace(/^data:image\/jpeg;base64,/, '');
        me.upload(imgData);
    };
    img.src = url;
}

Uppik.prototype.getCanvas = function() {
    if (!this.canvas) {
        this.canvas = document.createElement('canvas');
    }
    return this.canvas;
}
