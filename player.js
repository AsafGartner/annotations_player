// refsCallback: (optional)
//   Will be called when the player enters a marker that has a `data-ref` attribute. The value of `data-ref` will be passed to the function.
//   When leaving a marker that a `data-ref` attribute, and entering a marker without one (or not entering a new marker at all), the function will be called with `null`.
function Player(htmlContainer, refsCallback) {
    this.container = htmlContainer;
    this.markersContainer = this.container.querySelector(".markers_container");
    this.videoContainer = this.container.querySelector(".video_container");
    this.refsCallback = refsCallback || function() {};

    if (!this.videoContainer.getAttribute("data-videoId")) {
        console.error("Expected to find data-videoId attribute on", this.videoContainer, "for player initialized on", this.container);
        throw new Error("Missing data-videoId attribute.");
    }
    this.markers = [];
    var markerEls = this.markersContainer.querySelectorAll(".marker");
    if (markerEls.length == 0) {
        console.error("No markers found in", this.markersContainer, "for player initialized on", this.container);
        throw new Error("Missing markers.");
    }
    for (var i = 0; i < markerEls.length; ++i) {
        var marker = {
            timestamp: parseInt(markerEls[i].getAttribute("data-timestamp"), 10),
            ref: markerEls[i].getAttribute("data-ref"),
            endTime: (i < markerEls.length - 1 ? parseInt(markerEls[i+1].getAttribute("data-timestamp"), 10) : null),
            el: markerEls[i],
            fadedProgress: markerEls[i].querySelector(".progress.faded"),
            progress: markerEls[i].querySelector(".progress.main"),
            hoverx: null
        };
        marker.el.addEventListener("click", this.onMarkerClick.bind(this, marker));
        marker.el.addEventListener("mousemove", this.onMarkerMouseMove.bind(this, marker));
        marker.el.addEventListener("mouseleave", this.onMarkerMouseLeave.bind(this, marker));
        this.markers.push(marker);
    }

    this.currentMarker = null;
    this.currentMarkerIdx = null;
    this.youtubePlayer = null;
    this.youtubePlayerReady = false;
    this.playing = false;
    this.shouldPlay = false;
    this.buffering = false;
    this.pauseAfterBuffer = false;
    this.speed = 1;
    this.currentTime = 0;
    this.lastFrameTime = 0;
    this.scrollTo = -1;
    this.scrollPosition = 0;
    this.nextFrame = null;
    this.looping = false;

    this.markersContainer.addEventListener("wheel", function(ev) {
        this.scrollTo = -1;
    }.bind(this));

    Player.initializeYoutube(this.onYoutubeReady.bind(this));
    this.updateSize();

    this.resume();
}

// Start playing the video from the current position.
// If the player hasn't loaded yet, it will autoplay when ready.
Player.prototype.play = function() {
    if (this.youtubePlayerReady) {
        if (!this.playing) {
            this.youtubePlayer.playVideo();
        }
    } else {
        this.shouldPlay = true;
    }
};

// Pause the video at the current position.
// If the player hasn't loaded yet, it will not autoplay when ready. (This is the default)
Player.prototype.pause = function() {
    if (this.youtubePlayerReady) {
        if (this.playing) {
            this.youtubePlayer.pauseVideo();
        } else if (this.buffering) {
            this.pauseAfterBuffer = true;
        }
    } else {
        this.shouldPlay = false;
    }
};

// Sets the current time. Does not affect play status.
// If the player hasn't loaded yet, it will seek to this time when ready.
Player.prototype.setTime = function(time) {
    this.currentTime = time;
    if (this.youtubePlayerReady) {
        this.currentTime = Math.max(0, Math.min(this.currentTime, this.youtubePlayer.getDuration()));
        this.youtubePlayer.seekTo(this.currentTime);
    }
    this.updateProgress();
};

Player.prototype.jumpToNextMarker = function() {
    var targetMarkerIdx = Math.min((this.currentMarkerIdx === null ? 0 : this.currentMarkerIdx + 1), this.markers.length-1);
    var targetTime = this.markers[targetMarkerIdx].timestamp;
    this.setTime(targetTime);
    this.play();
};

Player.prototype.jumpToPrevMarker = function() {
    var targetMarkerIdx = Math.max(0, (this.currentMarkerIdx === null ? 0 : this.currentMarkerIdx - 1));
    var targetTime = this.markers[targetMarkerIdx].timestamp;
    this.setTime(targetTime);
    this.play();
};

// Call this after changing the size of the video container in order to update the youtube player.
Player.prototype.updateSize = function() {
    var width = this.videoContainer.offsetWidth;
    var height = width / 16 * 9;
    this.markersContainer.style.height = height;
    if (this.youtubePlayerReady) {
        this.youtubePlayer.setSize(Math.floor(width), Math.floor(height));
    }
}

// Stops the per-frame work that the player does. Call when you want to hide or get rid of the player.
Player.prototype.halt = function() {
    this.pause();
    this.looping = false;
    if (this.nextFrame) {
        cancelAnimationFrame(this.nextFrame);
        this.nextFrame = null;
    }
}

// Resumes the per-frame work that the player does. Call when you want to show the player again after hiding.
Player.prototype.resume = function() {
    this.looping = true;
    if (!this.nextFrame) {
        this.doFrame();
    }
}

Player.createHTMLSkeleton = function(videoId, markers) {
};

// timestamp can be either an int (number of seconds from beginning of the video) or a string ([hh:][mm:]ss)
Player.createHTMLMarker = function(timestamp, text, ref) {
    if (typeof(timestamp) == "string") {
        var timeParts = timestamp.split(":");
        var hours = (timeParts.length == 3 ? parseInt(timeParts[0], 10) : 0);
        var minutes = (timeParts.length > 1 ? parseInt(timeParts[timeParts.length-2], 10) : 0);
        var seconds = parseInt(timeParts[timeParts.length-1], 10);
        timestamp = hours * 60 * 60 + minutes * 60 + seconds;
    }
    var marker = document.createElement("DIV");
    marker.classList.add("marker");
    marker.setAttribute("data-timestamp", timestamp);
    if (ref !== undefined && ref !== null) {
        marker.setAttribute("data-ref", ref);
    }

    var content = document.createElement("DIV");
    content.classList.add("content");

    var markerTime = "(";
    var hours = Math.floor(timestamp / 60 / 60);
    var minutes = Math.floor(timestamp / 60) % 60;
    var seconds = timestamp % 60;
    if (hours > 0) {
        markerTime += (hours < 10 ? "0" + hours : hours) + ":";
    }
    markerTime += (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds) + ")";

    content.textContent = markerTime + " " + text;
    marker.appendChild(content);

    var fadedProgress = document.createElement("DIV");
    fadedProgress.classList.add("progress");
    fadedProgress.classList.add("faded");
    fadedProgress.appendChild(content.cloneNode(true));
    marker.appendChild(fadedProgress);

    var progress = document.createElement("DIV");
    progress.classList.add("progress");
    progress.classList.add("main");
    progress.appendChild(content.cloneNode(true));
    marker.appendChild(progress);


    return marker;
};

Player.parseHMHAnnotation = function(text) {
    var annotation = {
        title: null,
        videoId: null,
        author: null,
        markers: []
    };

    var lines = text.split("\n");
    var mode = "none";
    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i];
        if (line == "---") {
            mode = "none";
        } else if (line.startsWith("title:")) {
            annotation.title = line.slice(7).replace(/"/g, "");
        } else if (line.startsWith("videoId:")) {
            annotation.videoId = line.slice(9).replace(/"/g, "");
        } else if (line.startsWith("author:")) {
            annotation.author = line.slice(8).replace(/"/g, ""); // Miblo, where's the author field?
        } else if (line.startsWith("markers")) {
            mode = "markers";
        } else if (mode == "markers") {
            var match = line.match(/"((\d+):)?(\d+):(\d+)": "(.+)"/);
            var marker = {
                timestamp: (match[2] ? parseInt(match[2], 10) : 0) * 60 * 60 + parseInt(match[3], 10) * 60 + parseInt(match[4], 10),
                text: match[5].replace(/\\"/g, "\"")
            }
            annotation.markers.push(marker);
        }
    }

    return annotation;
};

Player.parseAnnotation = function(text) {
};

Player.initializeYoutube = function(callback) {
    if (window.APYoutubeAPIReady === undefined) {
        window.APYoutubeAPIReady = false;
        window.APCallbacks = (callback ? [callback] : []);
        window.onYouTubeIframeAPIReady = function() {
            window.APYoutubeAPIReady = true;
            for (var i = 0; i < APCallbacks.length; ++i) {
                APCallbacks[i]();
            }
        };
        var scriptTag = document.createElement("SCRIPT");
        scriptTag.setAttribute("type", "text/javascript");
        scriptTag.setAttribute("src", "https://www.youtube.com/iframe_api");
        document.body.appendChild(scriptTag);
    } else if (window.APYoutubeAPIReady === false) {
        window.APCallbacks.push(callback);
    } else if (window.APYoutubeAPIReady === true) {
        callback();
    }
}

// END PUBLIC INTERFACE

Player.prototype.onMarkerClick = function(marker, ev) {
    var time = marker.timestamp;
    if (this.currentMarker == marker && marker.hoverx !== null) {
        time += (marker.endTime - marker.timestamp) * marker.hoverx;
    }
    this.setTime(time);
    this.play();
};

Player.prototype.onMarkerMouseMove = function(marker, ev) {
    if (this.currentMarker == marker) {
        marker.hoverx = (ev.offsetX - marker.el.offsetLeft) / marker.el.offsetWidth;
    }
};

Player.prototype.onMarkerMouseLeave = function(marker, ev) {
    marker.hoverx = null;
};

Player.prototype.updateProgress = function() {
    var prevMarker = this.currentMarker;
    this.currentMarker = null;
    this.currentMarkerIdx = null;

    for (var i = 0; i < this.markers.length; ++i) {
        var marker = this.markers[i];
        if (marker.timestamp <= this.currentTime && this.currentTime < marker.endTime) {
            this.currentMarker = marker;
            this.currentMarkerIdx = i;
            break;
        }
    }

    if (this.currentMarker) {
        var totalWidth = this.currentMarker.el.offsetWidth;
        var progress = (this.currentTime - this.currentMarker.timestamp) / (this.currentMarker.endTime - this.currentMarker.timestamp);
        if (this.currentMarker.hoverx === null) {
            var pixelWidth = progress * totalWidth;
            this.currentMarker.fadedProgress.style.width = Math.ceil(pixelWidth) + "px";
            this.currentMarker.fadedProgress.style.opacity = pixelWidth - Math.floor(pixelWidth);
            this.currentMarker.progress.style.width = Math.floor(pixelWidth) + "px";
        } else {
            this.currentMarker.fadedProgress.style.opacity = 1;
            this.currentMarker.progress.style.width = Math.floor(Math.min(this.currentMarker.hoverx, progress) * totalWidth) + "px";
            this.currentMarker.fadedProgress.style.width = Math.floor(Math.max(this.currentMarker.hoverx, progress) * totalWidth) + "px";
        }

    }

    if (this.currentMarker != prevMarker) {
        if (prevMarker) {
            prevMarker.el.classList.remove("current");
            prevMarker.fadedProgress.style.width = "0px";
            prevMarker.progress.style.width = "0px";
            prevMarker.hoverx = null;
        }

        if (this.currentMarker) {
            this.currentMarker.el.classList.add("current");
            this.scrollTo = this.currentMarker.el.offsetTop + this.currentMarker.el.offsetHeight/2.0;
            this.scrollPosition = this.markersContainer.scrollTop;
        }

        if (this.currentMarker && this.currentMarker.ref) {
            this.refsCallback(this.currentMarker.ref);
        } else if (prevMarker && prevMarker.ref) {
            this.refsCallback(null);
        }
    }
};

Player.prototype.doFrame = function() {
    var now = performance.now();
    var delta = (now - this.lastFrameTime) / 1000.0;
    this.lastFrameTime = now;
    if (this.playing) {
        this.currentTime += delta * this.speed;
    }
    this.updateProgress();

    if (this.scrollTo >= 0) {
        var targetPosition = this.scrollTo - this.markersContainer.offsetHeight/2.0;
        targetPosition = Math.max(0, Math.min(targetPosition, this.markersContainer.scrollHeight - this.markersContainer.offsetHeight));
        this.scrollPosition += (targetPosition - this.scrollPosition) * 0.1;
        if (Math.abs(this.scrollPosition - targetPosition) < 1.0) {
            this.markersContainer.scrollTop = targetPosition;
            this.scrollTo = -1;
        } else {
            this.markersContainer.scrollTop = this.scrollPosition;
        }
    }

    this.nextFrame = requestAnimationFrame(this.doFrame.bind(this));
};

Player.prototype.onYoutubePlayerReady = function() {
    this.youtubePlayerReady = true;
    this.markers[this.markers.length-1].endTime = this.youtubePlayer.getDuration();
    this.updateSize();
    this.youtubePlayer.setPlaybackQuality("hd1080");
    if (this.currentTime > 0) {
        this.currentTime = Math.max(0, Math.min(this.currentTime, this.youtubePlayer.getDuration()));
        this.youtubePlayer.seekTo(this.currentTime, true);
    }
    if (this.shouldPlay) {
        this.youtubePlayer.playVideo();
    }
};

Player.prototype.onYoutubePlayerStateChange = function(ev) {
    if (ev.data == YT.PlayerState.PLAYING) {
        this.playing = true;
        this.currentTime = this.youtubePlayer.getCurrentTime();
    } else if (ev.data == YT.PlayerState.PAUSED || ev.data == YT.PlayerState.BUFFERING) {
        this.playing = false;
        this.currentTime = this.youtubePlayer.getCurrentTime();
        this.updateProgress();
    } else {
        this.playing = false;
    }

    this.buffering = ev.data == YT.PlayerState.BUFFERING;
    if (this.playing && this.pauseAfterBuffer) {
        this.pauseAfterBuffering = false;
        this.pause();
    }
};

Player.prototype.onYoutubePlayerPlaybackRateChange = function(ev) {
    this.speed = ev.data;
};

Player.prototype.onYoutubeReady = function() {
    var youtubePlayerDiv = document.createElement("DIV");
    youtubePlayerDiv.id = "youtube_player_" + Player.youtubePlayerCount++;
    this.videoContainer.appendChild(youtubePlayerDiv);
    this.youtubePlayer = new YT.Player(youtubePlayerDiv.id, {
        videoId: this.videoContainer.getAttribute("data-videoId"),
        width: this.videoContainer.offsetWidth,
        height: this.videoContainer.offsetWidth / 16 * 9,
        events: {
            "onReady": this.onYoutubePlayerReady.bind(this),
            "onStateChange": this.onYoutubePlayerStateChange.bind(this),
            "onPlaybackRateChange": this.onYoutubePlayerPlaybackRateChange.bind(this)
        }
    });
};

Player.youtubePlayerCount = 0;
