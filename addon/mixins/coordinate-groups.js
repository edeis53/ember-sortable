import Ember from 'ember';

import computed from 'ember-new-computed';
import {invokeAction} from 'ember-invoke-action';

import SortableItemMixin from './sortable-item';

//extend the sortable-item-mixin and override methods
export default Ember.Mixin.create(SortableItemMixin, {
    dragCoordinator: Ember.inject.service(),



    //which group to tell that we are dragging this item?
    _tellGroup(method, ...args) {

      let group = this.get('group');
      /*
      if (this.get('dragCoordinator').swapGroups)
      {
        group = this.get('dragCoordinator').activeDropGroup;
      } else {
        group = this.get('group');
      }*/

      if (group) {
        group[method](...args);
      }
    },



    /**
      @method _startDrag
      @private
    */
    _startDrag(event) {
      if (this.get('isBusy')) { return; }

      let drag = this._makeDragHandler(event);

      //Tell the dragCoordinator what element we are dragging (Ember object), as each item is a sortable-dragdrop-component.
      this.get('dragCoordinator').currentDragItem = this;  //ED

      let drop = () => {
        $(window)
          .off('mousemove touchmove', drag)
          .off('click mouseup touchend', drop);

        this._drop();
      };

      $(window)
        .on('mousemove touchmove', drag)
        .on('click mouseup touchend', drop);

      this._tellGroup('prepare');
      this.set('isDragging', true);
      invokeAction(this, 'onDragStart', this.get('model'));

      //DISABLE SCROLLING
      //this._scrollOnEdges(drag);
    },


    /**
      @method _makeDragHandler
      @param {Event} startEvent
      @return {Function}
      @private
    */
    _makeDragHandler(startEvent) {
      const groupDirection = this.get('group.direction');
      let dragOrigin;
      let elementOrigin;
      let scrollOrigin;
      let parentElement = $(this.element.parentNode);

      if (groupDirection === 'x') {
        dragOrigin = getX(startEvent);
        elementOrigin = this.get('x');
        scrollOrigin = parentElement.offset().left;

        return event => {
          //inform the dragCoordinator of this drag movement
          this.get('dragCoordinator').dragEvent(event); //ED
          this._pageX = getX(event);
          let dx = this._pageX - dragOrigin;
          let scrollX = parentElement.offset().left;
          let x = elementOrigin + dx + (scrollOrigin - scrollX);

          this._drag(x);
        };
      }

      if (groupDirection === 'y') {
        dragOrigin = getY(startEvent);
        elementOrigin = this.get('y');
        scrollOrigin = parentElement.offset().top;

        return event => {
          //inform the dragCoordinator of this drag movement
          this.get('dragCoordinator').dragEvent(event); //ED
          this._pageY = getY(event);
          let dy = this._pageY - dragOrigin;
          let scrollY = parentElement.offset().top;
          let y = elementOrigin + dy + (scrollOrigin - scrollY);

          this._drag(y);
        };
      }
    },


});

//Fucntions that weren't included in the mixin: copied over.

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
