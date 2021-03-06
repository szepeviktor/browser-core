/* eslint func-names: 'off' */

import background from '../core/base/background';
import MessageCenter from './message-center';
import MessageHandlerBase from './handlers/base';
import Triggers from './triggers/triggers';

/**
  @namespace message-center
  @module message-center
  @class Background
 */
export default background({

  /**
    @method init
    @param settings
  */
  init() {
    this.messageCenter = MessageCenter.getInstance();
    (new Triggers()).init();
  },

  unload() {


  },

  beforeBrowserShutdown() {

  },

  events: {
    'msg_center:show_message': function (...args) {
      this.messageCenter.showMessage.call(this.messageCenter, ...args);
    },
    'msg_center:hide_message': function (...args) {
      this.messageCenter.hideMessage.call(this.messageCenter, ...args);
    },
  },

  actions: {
    registerMessageHandler(id, handler) {
      class NewMessageHandler extends MessageHandlerBase {
        _renderMessage(message) {
          handler(message);
        }

        _hideMessage() {
          // TODO
        }
      }
      this.messageCenter.registerMessageHandler(id, new NewMessageHandler());
    },
    getHandlers() {
      return this.messageCenter.getHandlers();
    },
    showMessage(handler, message) {
      this.messageCenter.showMessage(message, handler);
    },
    hideMessage(handlerID, message) {
      this.messageCenter.hideMessage(message, handlerID);
    }
  },
});
