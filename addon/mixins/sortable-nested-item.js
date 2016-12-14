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
  //https://guides.emberjs.com/v2.9.0/components/customizing-a-components-element/#toc_customizing-the-element-s-class
  classNameBindings: ['hasChildren:sortable-has-children','isDragging:ghost'],
  //add the ghost class to the hidden dragged component. Prevents flickering between showing the ghost and hiding the dragged component.


    /**
      True if the item is currently being dragged.
      @property isDragging
      @type Boolean
      @default false
    */
    isDragging: false,

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
    _originalOffset: null,

    //save the height before we scale it to add items.
    _originalHeight: null,
    _height: null, //current height to render too.
    isChangingHeight: false, //track if the item is currently undergoing a height change.

    //track when moving items out of folders (child model originates inside)
    //we could also probably use something like: this.currentlyDraggedComponent.get('parent') !== item for our checking, but this seems easier for now.
    swapFromFolder: false,

    //keep track if this object has the dragSpacer above it. Useful for on/off states.
    hasDragSpacerAbove: null,

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

    //because of margin differences for folders and root items, we calculate the size of the dragged item once it has the appropriate class applied.
    swappedDestinationHeight: 0,

    //position names for easy code readibility
    //when getting the height of the item, we must remove margin
    //outerHeight doesn't include margin by default.
    //http://api.jquery.com/outerheight/
    topEdge: computed(function() {
      return this.get('y');
    }).volatile(),

    bottomEdge: computed(function() {
      return this.get('y') + $(this.element).outerHeight();
    }).volatile(),

    middlePosition: computed(function() {
      return $(this.element).offset().top + ($(this.element).outerHeight() / 2);
    }).volatile(),


    changeHeight(value) {
      //when height is set to auto or not manually defined as px value, it can't be used with transform, because it resets the height to 0 px before doing the transform in Safari if starting from auto. We need to set it to the original height first.


      if(value === "auto")
      {

        //only change the height if necessary, prevents accidental duplicate calls
        if(parseFloat($(this.element).css("height")) !== parseFloat(this._originalHeight))
        {
            //disable transitions
            $(this.element).css('transition', 'none');

            //define a minimum height to prevent DOM transitioning from 0px (auto)
            if(this._originalHeight >= this._height)
            {
              $(this.element).css('min-height', this._height+"px");
            } else {
              $(this.element).css('min-height', this._originalHeight+"px");
            }

            //set the height to the current value
            $(this.element).css( "height", this._height+"px");

            $(this.element).height(); // Force-apply styles

            //re-enable transitions
            $(this.element).css('transition', '');

            //change the height back to original value
            $(this.element).css("height", this._originalHeight+"px").css("min-height", this._originalHeight+"px");


            console.log("HEIGHT::Reset to auto "+this.elementId);

            //reset the height of the object.
            this.set('_height', this._originalHeight);

        } else {
          //console.log("HEIGHT::Changing duplicate call didn't run");
        }





      } else {
        //value is a number.

        //only change the height if necessary, prevents accidental duplicate calls
        if(parseFloat($(this.element).css("height")) !== parseFloat(value))
        {
          //disable transitions
          $(this.element).css('transition', 'none');

          //define a minimum height to prevent DOM transitioning from 0px (auto)
          if(this._originalHeight >= this._height)
          {
            $(this.element).css('min-height', this._height+"px");
          } else {
            $(this.element).css('min-height', this._originalHeight+"px");
          }

          //set the height to the original value
          $(this.element).css("height", this._originalHeight+"px");

          $(this.element).height(); // Force-apply styles

          //re-enable transitions
          $(this.element).css('transition', '');

          //change the height
          $(this.element).css("height", value+"px").css("min-height", value+"px");
        } else {
          //console.log("HEIGHT::Changing duplicate call didn't run");
        }


        //console.log("HEIGHT::Changing "+this.elementId);
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
          this._originalOffset = this._y = $(this.element).offset().top; //ED convert from relative to parent, this.element.offsetTop;, to jquery which uses position within document.$(this.element).offset().top
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

    /**
      Horizontal position of the item.
      @property x
      @type Number
    */
    xdrag: computed({
      get() {
        if (this._xdrag === undefined) {
          let marginLeft = parseFloat(this.$().css('margin-left'));
          this._xdrag = this.element.scrollLeft + this.element.offsetLeft - marginLeft;
        }

        return this._xdrag;
      },
      set(_, value) {
        if (value !== this._xdrag) {
          this._xdrag = value;
          this._scheduleApplyPositionDrag();
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
    ydrag: computed({
      get() {
        if (this._ydrag === undefined) {
          //this._y = this.element.offsetTop;
          this._originalOffset = this._ydrag = $(this.element).offset().top; //ED convert from relative to parent, this.element.offsetTop;, to jquery which uses position within document.$(this.element).offset().top
          //save the value as offset for future reference.
        }

        return this._ydrag;
      },
      set(key, value) {
        //perform update only if the update value is different from the current private position.
        //this._y was initialized earlier when we called _makeDragHandler and set "elementOrigin"
        if (value !== this._ydrag) {
          this._ydrag = value; //save the _y position to compare later. (cached)
          //_scheduleApplyPosition, sortable-item position is only updated if we need to.
          this._scheduleApplyPositionDrag();
        }
      }
    }).volatile(), //Call on a computed property to set it into non-cached mode. When in this mode the computed property will not automatically cache the return value.


    /**
      @method _scheduleApplyPosition
      @private
    */
    /**
      012: Schedule apply position to run once on the next render loop
              -called during set.x or set.y
    **/
    _scheduleApplyPositionDrag() {
      run.scheduleOnce('render', this, '_applyPositionDrag');
    },

    /**
      013: Apply the new position of the sortable-item by changing it's CSS transform.
              -called during set.x or set.y
    **/
    _applyPositionDrag() {
      //if we don't have a DOM element or there isn't Jquery, then quit.
      if (!this.element || !this.$()) { return; }

      //are we sorting Y axis or X axis?
      const groupDirection = this.get('group.direction');

      if (groupDirection === 'x') {
        let x = this.get('xdrag');
        let dx = x - this.element.offsetLeft + parseFloat(this.$().css('margin-left'));

        if(this.isDragging === true)
        {
          $("#"+this.ghostId).css({
            transform: `translateX(${dx}px)`
          });
        } else {
          this.$().css({
            transform: `translateX(${dx}px)`
          });
        }



      }

      //Here's what we are doing
      if (groupDirection === 'y') {
        //get the Y position that we need to update to.
        //y contains the element's orignal start position +/- the amount the mouse has moved
        let y = this.get('ydrag');

        //Subtract the y position of the sortable-item component from the top of it's parent (sortable-group)
            //At first appearenace doesn't appear to be really necessary.
            //eg, in the drag event, we are calculating Y as:
            //let y = elementOrigin + dy
            //where elementOrigin is equal to this.element.offsetTop.
            //It'd be the same value if we didn't add it anyways.
            //WHY: We just using CSS transform to visually move the element in the dom.
            //However, the sortable-item-component is storing the actual position in the dom as it's y property, which we'll use when sorting the objects in the group. All is good.
        //In this case y is just the distance the mouse moved.
        let dy = y - this._originalOffset;
        //let dy = y - $(this.element).offset().top; //ED convert from this.element.offsetTop which is just relative to parent, to jquery which is relative to document. //$(this.element).offset().top

        //console.log ("y ="+y+"dy ="+dy);
        //transform the position of the sortable-item element by the distance that the mouse has moved.

        //if dragging, transform the ghost element only.
        if(this.isDragging === true)
        {
          $("#"+this.ghostId).css({
            transform: `translateY(${dy}px)`
          });
        } else {
          this.$().css({
            transform: `translateY(${dy}px)`
          });
        }

      }
    },

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

      run.schedule('afterRender', () => {
        this._originalHeight = this._height = $(this.element).outerHeight();

        //set a minimum height to prevent flickering in safari.
        //css height transitions starting from auto end up starting at a height of 0 first!
        $(this.element).css('min-height', this._height);
      });


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

        //on run if not dragging.
        //if dragging, we need to destroyGhost during drop.
        if(this.isDropping === false && this.isDragging !== true)
        {
          this._tellGroup('destroyGhost'); //ED. If the user clicks, but then doesn't drag.
        }

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
      this._scrollOnEdges(drag);
    },

    /**
      The maximum scroll speed when dragging element.
      @property maxScrollSpeed
      @default 20
     */
    maxScrollSpeed: 5,

    //pixel threshold to the bottom or top edge to start scrolling
    scrollThreshold: 50,
    //where is the top?
    scrollTopOffsetElement: null,

      _scrollOnEdges(drag) {
        let groupDirection = this.get('group.direction');
        let $element = $(this.ghostElement()); //track the positiong of the ghost element

        //scroll thresholds
        var scrollThreshold = this.scrollThreshold;
        var topThreshold = ( this.scrollTopOffsetElement ? $(this.scrollTopOffsetElement).offset().top + scrollThreshold : 0);

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
            return $element.offset().top - topThreshold;
          },
          get bottom() {
            //have to remove the top adjustment
            return this.top + topThreshold + this.height + scrollThreshold;
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

          var scrolledToBottom = false;
          if(($(window).scrollTop() + window.innerHeight) >= $(document).height()) {
            //have to use window.innerHeight instead of $(window).height() to work on iOS.
            //tried a variety of solutions.
            //http://stackoverflow.com/questions/8220267/jquery-detect-scroll-at-bottom
            //http://stackoverflow.com/questions/11172917/jquery-detect-bottom-of-page-on-mobile-safari-ios
              //console.log("at the bottom");
              scrolledToBottom = true;
          }

          //ED only run if dragging and not dropping.
          //wierd bug where it was scrolling a small amountwhile dropping.
          //Also, don't scroll if at the top or botom.
          if (((scrolledToBottom === false && delta > 0) || (delta < 0 && $(window).scrollTop() > 0)) &&  delta !== 0 && this.isDragging === true && this.isDropping === false) {
            let speed = this.get('maxScrollSpeed');
            delta = Math.min(Math.max(delta, -1 * speed), speed);

            delta = scrollContainer[scrollKey](scroll + delta) - scroll;

            //bug is here with the fake drag event.
            //should be fixed with the above conditions checking the drag/drop state.
              let event = createFakeEvent();
              if (event) {
                if (scrollContainer.isWindow) {
                  event[pageKey] += delta;
                }
                run(() => drag(event));
              }

          }
          if (this.get('isDragging') === true) {
            requestAnimationFrame(checkScrollBounds);
          }
        };

        if (!Ember.testing) {
          requestAnimationFrame(checkScrollBounds);
        }
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
        elementOrigin = this.get('xdrag');
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
        elementOrigin = this.get('ydrag');
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
          //let y = elementOrigin + dy + (scrollOrigin - scrollY);

          //ED disable scrollOrigin function. Doesn't play well when you increase the size of an item to drop inside.
          //To recreate: Make two sets of nested items. Drag the nested item from the bottom set into the top set, you'll see the error. ScrollY changes becuase we have a new offset top of this element.
          let y = elementOrigin + dy;

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
      @method _drag
      @private
    */
    /**
      010: _drag runs on each mouseMove with new position of the sortable element (it's origin +/- mouseMove distance)
              --dimension is just the value of pixels to move.
    **/
    _drag(dimension) {
      //try scrolling
      //this.scrollMe();


      //The frequency with which the group is informed that an update is required.
      let updateInterval = this.get('updateInterval');

      //what direction is the sortable-group using? default is y axis sorting.
      const groupDirection = this.get('group.direction');

      if (groupDirection === 'x') {
        this.set('xdrag', dimension);
      }

      //We are using Y axis sorting.
      //now update the position of the sortable-item component.
      /**
        013.2: Calling this.set('y') applies the new position of the sortable-item by changing it's CSS transform.
      **/
      if (groupDirection === 'y') {
        this.set('ydrag', dimension);
      }

      /**
        014: Update the group.
              --if we don't. All that we've accomplished is just dragging the sortable-item, which is stuck to the mouse. The elements don't reshuffle, that is accomplished by updating the group.

      **/
      run.throttle(this, '_tellGroup', 'update', updateInterval);
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
        //In this case y is just the distance the mouse moved.
        let dy = y - this._originalOffset;
        //let dy = y - $(this.element).offset().top; //ED convert from this.element.offsetTop which is just relative to parent, to jquery which is relative to document. //$(this.element).offset().top

        //console.log ("y ="+y+"dy ="+dy);
        //transform the position of the sortable-item element by the distance that the mouse has moved.

          this.$().css({
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

      //this._tellGroup('destroyGhost'); //ED

      //convert the drag coordinates to actual coordinates to update the item's position.
      this._y = this._ydrag;
      this._x = this._xdrag;

      this._tellGroup('dropUpdate'); //destroyGhost as well

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
    },


    /**
      @method reset
    */
    reset() {
      let el = this.$();
      if (!el) { return; }

      delete this._y;
      delete this._x;
      delete this._ydrag;
      delete this._xdrag;

      //reset height
      this._originalHeight = this._height = $(this.element).outerHeight();

      //reset swap, used for tracking when children are moved out of folders
      this.swapFromFolder = false;

      el.css({ transform: '', height: ''  }); //reset height here too, revert from defined height (left over from a swap drop) and change to auto.
      el.height(); // Force-apply styles
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
