import Ember from 'ember';
import computed from 'ember-new-computed';
import scrollParent from '../system/scroll-parent';
import ScrollContainer from '../system/scroll-container';
import {invokeAction} from 'ember-invoke-action';

const { Mixin, $, run } = Ember;
const { Promise } = Ember.RSVP;

export default Mixin.create({
  classNames: ['sortable-item'],
  classNameBindings: ['isDragging', 'isDropping'],

  /**
    Group to which the item belongs.
    @property group
    @type SortableGroup
    @default null
  */
  group: null,

  /**
    Model which the item represents.
    @property model
    @type Object
    @default null
  */
  model: null,

  /**
    Selector for the element to use as handle.
    If unset, the entire element will be used as the handle.
    @property handle
    @type String
    @default null
  */
  handle: null,

  /**
    True if the item is currently being dragged.
    @property isDragging
    @type Boolean
    @default false
  */
  isDragging: false,

  /**
    Action that fires when the item starts being dragged.
    @property onDragStart
    @type Action
    @default null
  */
  onDragStart: null,

  /**
    Action that fires when the item stops being dragged.
    @property onDragStop
    @type Action
    @default null
  */
  onDragStop: null,

  /**
    True if the item is currently dropping.
    @property isDropping
    @type Boolean
    @default false
  */
  isDropping: false,

  /**
    True if the item was dropped during the interaction
    @property wasDropped
    @type Boolean
    @default false
  */
  wasDropped: false,


  /**
    @property isBusy
    @type Boolean
  */
  isBusy: computed.or('isDragging', 'isDropping'),

  /**
    The frequency with which the group is informed
    that an update is required.
    @property updateInterval
    @type Number
    @default 125
  */
  updateInterval: 125,

  /**
    Additional spacing between active item and the rest of the elements.
    @property spacing
    @type Number
    @default 0[px]
  */
  spacing: 0,  //is timed by two in sortable-group::update()  for above+below spacing.

  /**
    True if the item transitions with animation.
    @property isAnimated
    @type Boolean
  */
  isAnimated: computed(function() {
    if (!this.element || !this.$()) { return; }

    let el = this.$();
    let property = el.css('transition-property');

    return /all|transform/.test(property);
  }).volatile(),

  /**
    The current transition duration in milliseconds.
    @property transitionDuration
    @type Number
  */
  transitionDuration: computed(function() {
    let el = this.$();
    let rule = el.css('transition-duration');
    let match = rule.match(/([\d\.]+)([ms]*)/);

    if (match) {
      let value = parseFloat(match[1]);
      let unit = match[2];

      if (unit === 's') {
        value = value * 1000;
      }

      return value;
    }

    return 0;
  }).volatile(),

  /**
    Horizontal position of the item.
    @property x
    @type Number
  */
  x: computed({
    get() {
      if (this._x === undefined) {
        let marginLeft = parseFloat(this.$().css('margin-left'));
        this._x = this.element.scrollLeft + this.element.offsetLeft - marginLeft;
      }

      return this._x;
    },
    set(_, value) {
      if (value !== this._x) {
        this._x = value;
        this._scheduleApplyPosition();
      }
    },
  }).volatile(),

  /**
    Vertical position of the item relative to its offset parent.
    @property y
    @type Number
  */

  /**
    011: Now update the Y position of the sortable-item component.
  **/
  y: computed({
    get() {
      if (this._y === undefined) {
        this._y = this.element.offsetTop;
      }

      return this._y;
    },
    set(key, value) {
      //perform update only if the update value is different from the current private position.
      //this._y was initialized earlier when we called _makeDragHandler and set "elementOrigin"
      if (value !== this._y) {
        this._y = value; //save the _y position to compare later. (cached)
        //_scheduleApplyPosition, sortable-item position is only updated if we need to.
        this._scheduleApplyPosition();
      }
    }
  }).volatile(), //Call on a computed property to set it into non-cached mode. When in this mode the computed property will not automatically cache the return value.

  /**
    Width of the item.
    @property height
    @type Number
  */
  width: computed(function() {
    let el = this.$();
    let width = el.outerWidth(true);

    width += getBorderSpacing(el).horizontal;

    return width;
  }).volatile(),

  /**
    Height of the item including margins.
    @property height
    @type Number
  */

  /**
    016: Get the height of this sortable-item so sortable-group can determine the position to place the next item in the list.
   **/
  height: computed(function() {
    let el = this.$();
    let height = el.outerHeight();

    let marginBottom = parseFloat(el.css('margin-bottom'));
    height += marginBottom;

    height += getBorderSpacing(el).vertical;

    return height;
  }).volatile(),

  /**
    @method didInsertElement
  */
  didInsertElement() {
    /**
       001:  Registers this item with the sortable-group. Which sortable-group we talk to is defined by the GROUP property of this sortable-item.
     **/

    this._super();
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

  /**
    @method mouseDown
  */
  /**
     002.1:  On mouseDown or touchStart trigger _primeDrag and pass the mouse/touch event with it.
   **/
  mouseDown(event) {
    if (event.which !== 1) { return; }
    if (event.ctrlKey) { return; }

    this._primeDrag(event);
  },

  /**
    @method touchStart
  */
  /**
     002.2:  On mouseDown or touchStart trigger _primeDrag and pass the mouse/touch event with it.
   **/
  touchStart(event) {
    this._primeDrag(event);
  },

  /**
    @method freeze
  */
  freeze() {
    let el = this.$();
    if (!el) { return; }

    el.css({ transition: 'none' });
    el.height(); // Force-apply styles
  },

  /**
    @method reset
  */
  reset() {
    let el = this.$();
    if (!el) { return; }

    delete this._y;
    delete this._x;

    el.css({ transform: '' });
    el.height(); // Force-apply styles
  },

  /**
    @method thaw
  */
  thaw() {
    let el = this.$();
    if (!el) { return; }

    el.css({ transition: '' });
    el.height(); // Force-apply styles
  },

  /**
    @method _primeDrag
    @private
  */
  /**
     003: Setup the custom drag event. Since touch doesn't have a drag state, we bind our drag listener to the mouse move events.
   **/
  _primeDrag(event) {
    let handle = this.get('handle');

    //check is the user tapped on the handle. if not, quit.
    if (handle && !$(event.target).closest(handle).length) {
      return;
    }

    //stop any default actions of the mouseclick or tap
    event.preventDefault();
    event.stopPropagation();

    //arrow function
    //https://www.sitepoint.com/es6-arrow-functions-new-fat-concise-syntax-javascript/
    /* same as:
        this._startDragListener = function (event){
          return this._startDrag(event);
        }

    */
    this._startDragListener = event => this._startDrag(event);

    this._cancelStartDragListener = () => {
      $(window).off('mousemove touchmove', this._startDragListener);
    };

    /**
       004: The mouse is currently down. If they move their mouse, run the startDragListener ONCE ONLY
        -If they stop their click, cancel the draglistener from running on mouse mouve.
     **/
    $(window).one('mousemove touchmove', this._startDragListener);
    $(window).one('click mouseup touchend', this._cancelStartDragListener);
  },

  /**
    @method _startDrag
    @private
  */

  /**
     005: The user is clicking on the handle, with mousedown, and is now moving their mouse.
            -This funciton runs once.
   **/
  _startDrag(event) {
    //if we are already dragging or are in the process of dropping, then exit. This doesn't need to be called again.
    if (this.get('isBusy')) { return; }


    /**
       006: Pass the mouseMove event to makeDragHandler.
              --Returns an event that calls the _drag function with new position of the sortable element (it's origin +/- mouseMove distance)
     **/
    let drag = this._makeDragHandler(event);


    //Create the DROP function, which removes the listeners and calls _drop
    let drop = () => {
      $(window)
        .off('mousemove touchmove', drag)
        .off('click mouseup touchend', drop);

      this._drop();
    };

    /**
      009: Call the _drag function with new position of the sortable element (it's origin +/- mouseMove distance)
    **/
    $(window)
      .on('mousemove touchmove', drag)
      .on('click mouseup touchend', drop);


    /**
      009.1: cache the original position of the first sortable-item within the group to a private variable the sortable-group for reference: sortable-group.this._itemPosition
    **/
    this._tellGroup('prepare');


    this.set('isDragging', true);
    invokeAction(this, 'onDragStart', this.get('model'));

    //Handle for autoscrolling
    //DISABLED
    //this._scrollOnEdges(drag);
  },

  /**
    The maximum scroll speed when dragging element.
    @property maxScrollSpeed
    @default 20
   */
  maxScrollSpeed: 20,

  _scrollOnEdges(drag) {
    let groupDirection = this.get('group.direction');
    let $element = this.$();
    let scrollContainer = new ScrollContainer(scrollParent($element)[0]);
    let itemContainer = {
      width: $element.width(),
      height: $element.height(),
      get left() {
        return $element.offset().left;
      },
      get right() {
        return this.left + this.width;
      },
      get top() {
        return $element.offset().top;
      },
      get bottom() {
        return this.top + this.height;
      }
    };

    let leadingEdgeKey, trailingEdgeKey, scrollKey, pageKey;
    if (groupDirection === 'x') {
      leadingEdgeKey = 'left';
      trailingEdgeKey = 'right';
      scrollKey = 'scrollLeft';
      pageKey = 'pageX';
    } else {
      leadingEdgeKey = 'top';
      trailingEdgeKey = 'bottom';
      scrollKey = 'scrollTop';
      pageKey = 'pageY';
    }

    let createFakeEvent = () => {
      if (this._pageX == null && this._pageY == null) { return; }
      return {
        pageX: this._pageX,
        pageY: this._pageY
      };
    };

    // Set a trigger padding that will start scrolling
    // the box when the item reaches within padding pixels
    // of the edge of the scroll container.
    let checkScrollBounds = () => {
      let leadingEdge = itemContainer[leadingEdgeKey];
      let trailingEdge = itemContainer[trailingEdgeKey];
      let scroll = scrollContainer[scrollKey]();

      let delta = 0;
      if (trailingEdge >= scrollContainer[trailingEdgeKey]) {
        delta = trailingEdge - scrollContainer[trailingEdgeKey];
      } else if (leadingEdge <= scrollContainer[leadingEdgeKey]) {
        delta = leadingEdge - scrollContainer[leadingEdgeKey];
      }

      if (delta !== 0) {
        let speed = this.get('maxScrollSpeed');
        delta = Math.min(Math.max(delta, -1 * speed), speed);

        delta = scrollContainer[scrollKey](scroll + delta) - scroll;

        let event = createFakeEvent();
        if (event) {
          if (scrollContainer.isWindow) {
            event[pageKey] += delta;
          }
          run(() => drag(event));
        }
      }
      if (this.get('isDragging')) {
        requestAnimationFrame(checkScrollBounds);
      }
    };

    if (!Ember.testing) {
      requestAnimationFrame(checkScrollBounds);
    }
  },

  /**
    @method _makeDragHandler
    @param {Event} startEvent
    @return {Function}
    @private
  */

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

  /**
    @method _tellGroup
    @private
  */

  /**
    001: Relay's didInsertElement to registerItem
    Which sortable-group we talk to is defined by the GROUP property of this sortable-item.
   **/
  _tellGroup(method, ...args) {
    let group = this.get('group');

    if (group) {
      group[method](...args);
    }
  },

  /**
    @method _scheduleApplyPosition
    @private
  */
  /**
    012: Schedule apply position to run once on the next render loop
            -called during set.x or set.y
  **/
  _scheduleApplyPosition() {
    run.scheduleOnce('render', this, '_applyPosition');
  },

  /**
    @method _applyPosition
    @private
  */

  /**
    013: Apply the new position of the sortable-item by changing it's CSS transform.
            -called during set.x or set.y
  **/
  _applyPosition() {
    //if we don't have a DOM element or there isn't Jquery, then quit.
    if (!this.element || !this.$()) { return; }

    //are we sorting Y axis or X axis?
    const groupDirection = this.get('group.direction');

    if (groupDirection === 'x') {
      let x = this.get('x');
      let dx = x - this.element.offsetLeft + parseFloat(this.$().css('margin-left'));

      this.$().css({
        transform: `translateX(${dx}px)`
      });
    }

    //Here's what we are doing
    if (groupDirection === 'y') {
      //get the Y position that we need to update to.
      //y contains the element's orignal start position +/- the amount the mouse has moved
      let y = this.get('y');

      //Subtract the y position of the sortable-item component from the top of it's parent (sortable-group)
          //At first appearenace doesn't appear to be really necessary.
          //eg, in the drag event, we are calculating Y as:
          //let y = elementOrigin + dy
          //where elementOrigin is equal to this.element.offsetTop.
          //It'd be the same value if we didn't add it anyways.
          //WHY: We just using CSS transform to visually move the element in the dom.
          //However, the sortable-item-component is storing the actual position in the dom as it's y property, which we'll use when sorting the objects in the group. All is good.
      //In this case y i just the distance the mouse moved.
      let dy = y - this.element.offsetTop;

      //transform the position of the sortable-item element by the distance that the mouse has moved.
      this.$().css({
        transform: `translateY(${dy}px)`
      });
    }
  },

  /**
    @method _drag
    @private
  */
  /**
    010: _drag runs on each mouseMove with new position of the sortable element (it's origin +/- mouseMove distance)
            --dimension is just the value of pixels to move.
  **/
  _drag(dimension) {
    //The frequency with which the group is informed that an update is required.
    let updateInterval = this.get('updateInterval');

    //what direction is the sortable-group using? default is y axis sorting.
    const groupDirection = this.get('group.direction');

    if (groupDirection === 'x') {
      this.set('x', dimension);
    }

    //We are using Y axis sorting.
    //now update the position of the sortable-item component.
    /**
      013.2: Calling this.set('y') applies the new position of the sortable-item by changing it's CSS transform.
    **/
    if (groupDirection === 'y') {
      this.set('y', dimension);
    }

    /**
      014: Update the group.
            --if we don't. All that we've accomplished is just dragging the sortable-item, which is stuck to the mouse. The elements don't reshuffle, that is accomplished by updating the group.

    **/
    run.throttle(this, '_tellGroup', 'update', updateInterval);
  },

  /**
    @method _drop
    @private
  */
  /**
    017:   mouseUp or toucheEnd has been triggered. Time to drop!
   **/

  _drop() {
    //If we don't have an html element or there is no jquery, quit.
    if (!this.element || !this.$()) { return; }

    //stop any propogration of click in this sortable-item
    this._preventClick(this.element);

    //set the dragging state to false, useful for CSS classes and callbacks.
    this.set('isDragging', false);
    //set the dropping state to true for css or callbacks
    this.set('isDropping', true);

    //update the sort order of the group for the last time. Doesn't do anything different that when we are dragging. Works the same.
    this._tellGroup('update');

    //wait for all rendering to complete, then complete the drop.
    this._waitForTransition()
      .then(run.bind(this, '_complete'));
  },

  /**
    @method _preventClick
    @private
  */
  _preventClick(element) {
    $(element).one('click', function(e){ e.stopImmediatePropagation(); } );
  },

  /**
    @method _waitForTransition
    @private
    @return Promise
  */
  _waitForTransition() {
    return new Promise(resolve => {
      run.next(() => {
        let duration = 0;

        if (this.get('isAnimated')) {
          duration = this.get('transitionDuration');
        }

        run.later(this, resolve, duration);
      });
    });
  },

  /**
    @method _complete
    @private
  */
  /**
    018:   mouseUp or toucheEnd has been triggered. Time to drop!
   **/

  _complete() {
    //drag and drop is now complete.
    //Trigger the onDragStop callback and send it the model assigned to sortable-item-component.model, which is the model for this item only.
    invokeAction(this, 'onDragStop', this.get('model'));

    //we are done dropping now.
    this.set('isDropping', false);

    //set the wasDropped state of this sortable-item so when we commit below, we know which object was dragged.
    this.set('wasDropped', true);

    //tell the sortable-group to commit the changes.
    this._tellGroup('commit');
  }
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
