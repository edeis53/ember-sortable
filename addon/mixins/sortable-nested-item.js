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
    classNames: ['sortable-item'],
    //https://guides.emberjs.com/v2.9.0/components/customizing-a-components-element/#toc_customizing-the-element-s-class
    classNameBindings: ['isDragging', 'isDropping', 'hasChildren:sortable-has-children'],

    //if this object has a parent.
    //defined in the handlebars template
    parent: null,

    //store the children of this sortable-item, just like items in sortable-group
    children: computed(() => a()),

    //to determine which sortable-item or sortable-group component is the active drop target.
    pendingDropTarget: false,
    activeDropTarget: false,
    overlapDraggedItem: null, //how much of this item overlaps with the dragged item. If more that 50% than it is the drop target.

    //cached position of the first element in a folder.
    _childPosition: null,

    //save the position before css transforms manipulate it
    _offset: null,

    //unique id for ghost element (uses modelid)
    ghostId: null,

    ghostElement() {
      if(this.ghostId !== null)
      {
        return "#"+this.ghostId;
      } else {
        return this.element;
      }
    },

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
          //this._y = this.element.offsetTop;
          this._offset = this._y = $(this.element).offset().top; //ED convert from relative to parent, this.element.offsetTop;, to jquery which uses position within document.$(this.element).offset().top
          //save the value as offset for future reference.
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



    //http://blog.learningspaces.io/property-or-observer-emberjs-explained/
    hasChildren: function() {
      if(this.get('model.children') && this.get('model.children.length') > 0)
      {
        return true;
      } else {
        return false;
      }
    }.property('model.children'),

    /**
      @method didInsertElement
    */
    didInsertElement() {
      /**
         001:  Registers this item with the sortable-group. Which sortable-group we talk to is defined by the GROUP property of this sortable-item.
       **/

       //console.log(this.get('hasChildren'));
      //this._super(); //don't need the extended one firing.

      // scheduled to prevent deprecation warning:
      // "never change properties on components, services or models during didInsertElement because it causes significant performance degradation"
      run.schedule("afterRender", this, "_tellGroup", "registerItem", this);

      run.schedule("afterRender", this, "_tellGroup", "registerChildren", this); //register children with parent.

    },

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

      //tell the group what is the currently dragged component
      this._tellGroup('setCurrentlyDraggedComponent', this);//ED

      this._tellGroup('createGhost'); //ED

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
        this._tellGroup('destroyGhost'); //ED
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

          //console.log("mousey="+this._pageY);

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

          //console.log("this.element.offsetTop="+this.element.offsetTop+" $(this.element).offset().top="+$(this.element).offset().top);
          //console.log ("y = elementOrigin + dy + (scrollOrigin - scrollY) = "+elementOrigin +" "+ dy +" "+ scrollOrigin +" - "+ scrollY);
          /**
             009: Call the drag function with new position of the sortable element (it's origin +/- mouseMove distance)
           **/
          this._drag(y);
        };
      }
    },


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

        this.$("#"+this.ghostId).css({
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
        //In this case y is just the distance the mouse moved.
        let dy = y - this._offset;
        //let dy = y - $(this.element).offset().top; //ED convert from this.element.offsetTop which is just relative to parent, to jquery which is relative to document. //$(this.element).offset().top

        //console.log ("y ="+y+"dy ="+dy);
        //transform the position of the sortable-item element by the distance that the mouse has moved.
        $("#"+this.ghostId).css({
          transform: `translateY(${dy}px)`
        });
      }
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

      this._tellGroup('setCurrentlyDropping', true); //ED let the group know the state for easy checking

      this._tellGroup('destroyGhost'); //ED

      //update the sort order of the group for the last time. Doesn't do anything different that when we are dragging. Works the same.

      //Nov.27, update won't work here, because we've destroyedGhost and update checks droptarget.
      //this._tellGroup('update');

      //wait for all rendering to complete, then complete the drop.
      this._waitForTransition()
        .then(run.bind(this, '_complete'));
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

      this._tellGroup('setCurrentlyDropping', false); //ED let the group know the state for easy checking

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
