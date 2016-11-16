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
    //defined in the handlebars template
    parent: null,

    //store the children of this sortable-item, just like items in sortable-group
    children: computed(() => a()),

    //to determine which sortable-item or sortable-group component is the active drop target.
    pendingDropTarget: false,
    activeDropTarget: false,

    /**
       007: Receives ONCE: mouseMove event after the user clicks and starts to move.
              -This function runs only ONCE as well.
     **/
    _makeDragHandler(startEvent) {
      const groupDirection = this.get('group.direction');
      let dragOrigin;
      let elementOrigin;
      let scrollOrigin;

      //
      // **IMPORTANT FOR LATER**
      // WHO is the parent element the sortable-item? Should be the sortable-group component div/ul
      // Includes the whole node, eg. parent dive and all children.
      let parentElement = $(this.element.parentNode);

      if (groupDirection === 'x') {
        dragOrigin = getX(startEvent);
        elementOrigin = this.get('x');
        scrollOrigin = parentElement.offset().left;

        return event => {
          this._pageX = getX(event);

          //inform the dragCoordinator of this drag movement
          this._tellGroup('setCurrentPosition', getX(event), getY(event));//ED

          let dx = this._pageX - dragOrigin;
          let scrollX = parentElement.offset().left;
          let x = elementOrigin + dx + (scrollOrigin - scrollX);

          this._drag(x);
        };
      }

      //This is our default direction for a vertical list:
      if (groupDirection === 'y') {
        //get the Y position of our first click/movement
        dragOrigin = getY(startEvent);
        //get the Y position of this sortable-item component.  eg. this.element.offsetTop; on first call (init) here.
        elementOrigin = this.get('y');
        //get the difference between the parent div (most likely sortable-group) and the top of the page. DOM layout.
        //wil be the same value for all elements as they share the same parent.
        scrollOrigin = parentElement.offset().top;

        //console.log(dragOrigin+' '+elementOrigin+' '+scrollOrigin);

        /**
           008: Return the drag event, which will be run on all future mouseMoves
         **/
        return event => {
          //Get the mouse position relative to the top edge of the document (not window), so if you scroll down 500, the value should be 500
          this._pageY = getY(event);

          //inform the dragCoordinator of this drag movement
          this._tellGroup('setCurrentPosition', getX(event), getY(event));//ED

          //how far has the mouse moved from where we started clicking?
          //0 for same position. Negative values for moving upwards, and positive values for moving downwards.
          let dy = this._pageY - dragOrigin;

          //get the difference between the parent div (most likely sortable-group) and the top of the page. DOM layout.
          //doesn't change value.
          //Maybe it does matter if it is a scrollable DIV or something
          let scrollY = parentElement.offset().top;

          //See (scrollOrigin - scrollY) = 0 because they have the same values. So nothing we need to worry about here.
          // Add the distance the mouse has moved to the inital Y position of the sortable-item component.
          let y = elementOrigin + dy + (scrollOrigin - scrollY);

          /**
             009: Call the drag function with new position of the sortable element (it's origin +/- mouseMove distance)
           **/
          this._drag(y);
        };
      }
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
