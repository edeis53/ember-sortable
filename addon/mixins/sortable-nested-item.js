import Ember from 'ember';
import computed from 'ember-new-computed';
import scrollParent from '../system/scroll-parent';
import ScrollContainer from '../system/scroll-container';
import {invokeAction} from 'ember-invoke-action';

const { Mixin, $, run } = Ember;
const { Promise } = Ember.RSVP;


import SortableItemMixin from './sortable-item';
const { A, Component, get, set } = Ember;
const a = A;

//extend the original sortable-item-mixin and override methods
export default Ember.Mixin.create(SortableItemMixin, {

    //if this object has a parent.
    parent: null,

    //store the children of this sortable-item, just like items in sortable-group
    children: computed(() => a()),

    /**
      @method didInsertElement
    */
    didInsertElement() {
      /**
         001:  Registers this item with the sortable-group. Which sortable-group we talk to is defined by the GROUP property of this sortable-item.
       **/

      //ED skip calling the extended Mixin, even though it calls this._super() on whatever it is extending, which I think may be nothing.
      //this._super();

      // scheduled to prevent deprecation warning:
      // "never change properties on components, services or models during didInsertElement because it causes significant performance degradation"
      run.schedule("afterRender", this, "_tellGroup", "registerItem", this);
    },

    /**
      @method willDestroyElement
    */
    willDestroyElement() {
      // scheduled to prevent deprecation warning:
      // "never change properties on components, services or models during didInsertElement because it causes significant performance degradation"
      run.schedule("afterRender", this, "_tellGroup", "deregisterItem", this);

      // remove event listeners that may still be attached
      $(window).off('mousemove touchmove', this._startDragListener);
      $(window).off('click mouseup touchend', this._cancelStartDragListener);
    },



});

/**
  Gets the y offset for a given event.
  Work for touch and mouse events.
  @method getY
  @return {Number}
  @private
*/
function getY(event) {
  let originalEvent = event.originalEvent;
  let touches = originalEvent && originalEvent.changedTouches;
  let touch = touches && touches[0];

  if (touch) {
    return touch.screenY;
  } else {
    return event.pageY;
  }
}

/**
  Gets the x offset for a given event.
  @method getX
  @return {Number}
  @private
*/
function getX(event) {
  let originalEvent = event.originalEvent;
  let touches = originalEvent && originalEvent.changedTouches;
  let touch = touches && touches[0];

  if (touch) {
    return touch.screenX;
  } else {
    return event.pageX;
  }
}

/**
  Gets a numeric border-spacing values for a given element.

  @method getBorderSpacing
  @param {Element} element
  @return {Object}
  @private
*/
function getBorderSpacing(el) {
  el = $(el);

  let css = el.css('border-spacing'); // '0px 0px'
  let [horizontal, vertical] = css.split(' ');

  return {
    horizontal: parseFloat(horizontal),
    vertical: parseFloat(vertical)
  };
}
