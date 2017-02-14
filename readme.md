# How to reuse the player

There are a number of ways to play your own content through the player. We will go through them in order of difficulty.

## 0. Use player.js

Take a look at [the demo page](asafgartner.github.io/annotations_player/demo.html).
It contains four examples for setting up the player in your own page.

## 1. Use the player hosted on asafgartner.github.io/annotations_player/player.html

Pros:
* Already hosted.
* Very little work required to use.

Cons:
* Not embedded in your own page.
* Can't change the style.
* URL is long and ugly.

### What needs to be done:

#### 1. Create your annotation file:

The file should have the following format:
```
---
title: "Title of the video"
author: "Your name here"
videoId: "tWzslFE9Qvg"
markers:
    "0:35": "This thing happened at this time"
    "5:04": "Now this happened"
    "17:00": "Someone said \"This is how you escape quotes\""
    "3:54:09": "Nothing happened for a long time, but now things are happening again"
    "17:02:47": "This is a long video"
---
```
The `videoId` field contains Youtube's video ID of the video you want to play (`https://youtube.com/watch?v=[this part]`). There's no support for Vimeo yet.

#### 2. Host the file:

Host this file somewhere that will serve the file contents (and only the contents).
This can be easily done with https://gist.github.com:

1. Create a new gist and paste in your annotation file.
2. Click the "Raw" button to get the url to the file contents.

#### 3. Play:

You're done! Go to `http://asafgartner.github.io/annotations_player/player.html#[full url to the raw file here]` and it should play the video while tracking the markers.

Please contact me if you encounter any issues.

## 2. Host the player on your own, but still use a separate annotation file:

Pros:
* Embedded in your own page.
* You can change the player style.

Cons:
* Some setup required.
* Still loads and parses an annotation file before it can start playing.

### What needs to be done:

#### 1. Create your annotation file:

The file should have the following format:
```
---
title: "Title of the video"
author: "Your name here"
videoId: "tWzslFE9Qvg"
markers:
    "0:35": "This thing happened at this time"
    "5:04": "Now this happened"
    "17:00": "Someone said \"This is how you escape quotes\""
    "3:54:09": "Nothing happened for a long time, but now things are happening again"
    "17:02:47": "This is a long video"
---
```
The `videoId` field contains Youtube's video ID of the video you want to play (`https://youtube.com/watch?v=[this part]`). There's no support for Vimeo yet.

#### 2. Embed the player in your page:

1. Copy both `<style>` segments into your page's CSS.
2. Copy the `playerContainer` div along with all of its content into your page's HTML.
3. Copy the inline `<script>` segment into your page's javascript.
4. Copy the youtube iframe api `<script>` tag into your page's HTML.

**NOTE:** Make sure the youtube iframe api is the last piece of javascript to load in the page.

**NOTE:** If you'd like to put the inline js in a file and load it in the `<head>`, please make sure `generatePlayer` will only be called after the `playerContainer` is on the page.

#### 3. Customization:

1. Hardcoding the annotation file location:
  * Find the line that reads `var annotationsFileLocation = null;`
  * Replace `null` with the full url to your annotation file
  * Delete the line `var hash = ...` and the `if (hash ...` block, since we're no longer reading the url from `location.hash`

2. Change the style:
  * You can play with all the values in the `STREAMER STYLE` block in the CSS
  * You can change the width of the player by setting a fixed width on the `playerContainer` div
  * You may want to remove the `episodeList` anchor and styles
  * Instead of setting the author field in the annotation file, search for "Probably Miblo" and change it to another default
  * You can change the width of the markers column by changing the width of `.marker .content, .marker .complated` in the CSS
  * You can move the markers column to the left of the video simply by placing the `markersContainer` div before `videoContainer` (make sure both stay inside `middleContainer`)
  * If you want the video to autoplay when the page is loaded, add `player.playVideo()` to the `onPlayerReady` function after `start()`

Please contact me if you encounter any issues.

## 2. Host the player on your own and prepare the entire player's HTML on the server:

Pros:
* It might load faster, and you can cache the entire page on your server.
* You can manage the metadata in any way you like (database instead of text file maybe?).
* You can change whatever you like. Maybe you want to change the `author` span to a link to the author's page?

Cons:
* It requires more extensive modifications to the player's code.

### What needs to be done:

#### 1. Embed the player in your page:

1. Copy both `<style>` segments into your page's CSS.
2. Copy the `playerContainer` div along with all of its content into your page's HTML.
3. Copy the inline `<script>` segment into your page's javascript.
4. Copy the youtube iframe api `<script>` tag into your page's HTML.

**NOTE:** Make sure the youtube iframe api is the last piece of javascript to load in the page.

**NOTE:** If you'd like to put the inline js in a file and load it in the `<head>`, please make sure `generatePlayer` will only be called after the `playerContainer` is on the page.

#### 2. Modify the player:

1. Remove all the code under `// Page generation stuff`.
2. Add your own code to set `domReady = true` and call `initVideo()` once the DOM is ready.

#### 3. Rendering the player:

1. Fill in the `title` span with your video's title.
2. Fill in the `author` span with the author's name.
3. Add a `data-videoId` attribute to the `#player` div and set it to Youtube's video ID (`https://youtube.com/watch?v=[this part]`).

#### 4. Rendering the markers:

Each marker is composed of the following HTML structure:
```html
<div class="marker" data-timestamp="500">
  <div class="content">The marker's text goes here</div>
  <div class="fadedProgress">
    <div class="completed">The marker's text goes here</div>
  </div>
  <div class="progress">
    <div class="completed">The marker's text goes here</div>
  </div>
</div>
```
**NOTE:** `data-timestamp` is the number of seconds since the beginning of the video.

**NOTE:** The same marker's text is rendered three times into different elements. This is required in order to get the filling-in effect. It should be exactly the same text into all three elements.

These marker divs should be put inside the `markersContainer` div. They are expected to be sorted by `data-timestamp`.

#### 5. Customization:

1. Change the style:
  * You can play with all the values in the `STREAMER STYLE` block in the CSS
  * You can change the width of the player by setting a fixed width on the `playerContainer` div
  * You may want to remove the `episodeList` anchor and styles
  * You can change the width of the markers column by changing the width of `.marker .content, .marker .complated` in the CSS
  * You can move the markers column to the left of the video simply by placing the `markersContainer` div before `videoContainer` (make sure both stay inside `middleContainer`)
  * If you want the video to autoplay when the page is loaded, add `player.playVideo()` to the `onPlayerReady` function after `start()`

Please contact me if you encounter any issues.
