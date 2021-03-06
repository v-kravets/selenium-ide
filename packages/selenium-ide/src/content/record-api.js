/*
 * Copyright 2017 SideeX committers
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

import browser from "webextension-polyfill";
import { selenium } from "./commands-api";

let contentSideexTabId = -1;
let frameLocation = "";

function Recorder(window) {
  this.window = window;
  this.eventListeners = {};
  this.attached = false;
}

Recorder.eventHandlers = {};
Recorder.addEventHandler = function(handlerName, eventName, handler, options) {
  handler.handlerName = handlerName;
  if (!options) options = false;
  let key = options ? ("C_" + eventName) : eventName;
  if (!this.eventHandlers[key]) {
    this.eventHandlers[key] = [];
  }
  this.eventHandlers[key].push(handler);
};

Recorder.prototype.parseEventKey = function(eventKey) {
  if (eventKey.match(/^C_/)) {
    return { eventName: eventKey.substring(2), capture: true };
  } else {
    return { eventName: eventKey, capture: false };
  }
};

Recorder.prototype.attach = function() {
  if (!this.attached) {
    for (let eventKey in Recorder.eventHandlers) {
      const eventInfo = this.parseEventKey(eventKey);
      const eventName = eventInfo.eventName;
      const capture = eventInfo.capture;

      const handlers = Recorder.eventHandlers[eventKey];
      this.eventListeners[eventKey] = [];
      for (let i=0 ; i<handlers.length ; i++) {
        this.window.document.addEventListener(eventName, handlers[i], capture);
        this.eventListeners[eventKey].push(handlers[i]);
      }
    }
    this.attached = true;
  }
};

Recorder.prototype.detach = function() {
  for (let eventKey in this.eventListeners) {
    const eventInfo = this.parseEventKey(eventKey);
    const eventName = eventInfo.eventName;
    const capture = eventInfo.capture;
    for (let i = 0; i < this.eventListeners[eventKey].length; i++) {
      this.window.document.removeEventListener(eventName, this.eventListeners[eventKey][i], capture);
    }
  }
  this.eventListeners = {};
  this.attached = false;
};

// show element
function startShowElement(message){
  if (message.showElement) {
    const result = selenium["doShowElement"](message.targetValue);
    return Promise.resolve({result: result});
  }
}

function attachRecorderHandler(message) {
  if (message.attachRecorder) {
    recorder.attach();
  }
}

function detachRecorderHandler(message) {
  if (message.detachRecorder) {
    recorder.detach();
  }
}

if (!window._recordListener) {
  // injector event handlers
  window._recordListener = startShowElement;
  browser.runtime.onMessage.addListener(startShowElement);
} else {
  // recorder event handlers
  browser.runtime.onMessage.addListener(attachRecorderHandler);
  browser.runtime.onMessage.addListener(detachRecorderHandler);
}

// set frame id
(function getframeLocation() {
  let currentWindow = window;
  let currentParentWindow;
  while (currentWindow !== window.top) {
    currentParentWindow = currentWindow.parent;
    if (!currentParentWindow.frames.length) {
      break;
    }
    for (let idx = 0; idx < currentParentWindow.frames.length; idx++)
      if (currentParentWindow.frames[idx] === currentWindow) {
        frameLocation = ":" + idx + frameLocation;
        currentWindow = currentParentWindow;
        break;
      }
  }
  frameLocation = "root" + frameLocation;
})();

browser.runtime.sendMessage({ frameLocation: frameLocation });

const recorder = new Recorder(window);
window.recorder = recorder;
window.contentSideexTabId = contentSideexTabId;
window.Recorder = Recorder;

/* record */
export function record(command, target, value, insertBeforeLastCommand, actualFrameLocation) {
  browser.runtime.sendMessage({
    command: command,
    target: target,
    value: value,
    insertBeforeLastCommand: insertBeforeLastCommand,
    frameLocation: (actualFrameLocation != undefined ) ? actualFrameLocation : frameLocation,
    commandSideexTabId: contentSideexTabId
  });
}

window.record = record;

export { Recorder, recorder };
