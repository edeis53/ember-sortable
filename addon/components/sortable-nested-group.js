import Ember from 'ember';
import layout from '../templates/components/sortable-nested-group';
import computed from 'ember-new-computed';
import {invokeAction} from 'ember-invoke-action';

const { A, Component, get, set, run } = Ember;
const a = A;
const NO_MODEL = {};

import SortableGroupComponent from './sortable-group';

export default SortableGroupComponent.extend({
  layout,

  /**
    @property direction
    @type string
    @default y
  */
  direction: 'y',

  /**
    @property items
    @type Ember.NativeArray
  */
  items: computed(() => a()),

  //currentMousePosition
  currentMousePosition: {},

  //to determine which sortable-item or sortable-group component is the active drop target.
  //these are like sortable-item properties.
  pendingDropTarget: false,
  activeDropTarget: false, //if this group is the drop target, it's property will be true.

  activeDropTargetComponent: null, //keep a record of what the active drop target in the group is.

  //array of active drop targets
  activeDropTargets: computed(() => a()),

  /**
    Register an item with this group.
    @method registerItem
    @param {SortableItem} [item]
  */
  /**
     001:  Runs during didInsertElement() in sortable-item
   **/
  registerItem(item) {
    if(item.parent)
    {
      //find the parent in the list of items
      let parent = this.get('items').findBy('elementId', item.parent.elementId);
      //since the nested child components get rendered before their parents, they may return undefined
      if(parent === undefined)
      {
        //if that's the case, we need to add the parent, as well as this child element.
        item.parent.get('children').addObject(item);
        this.get('items').addObject(item.parent);
      } else {
        //the parent already exists, just add the child
        parent.get('children').addObject(item);
      }
    } else {
      //this item doesn't have any parents.
      //check and see if it has already been added
      if(this.get('items').findBy('elementId', item.elementId) === undefined)
      {
        this.get('items').addObject(item);
      }
    }
  },

  /**
    De-register an item with this group.
    @method deregisterItem
    @param {SortableItem} [item]
  */
  deregisterItem(item) {

    if(item.parent)
    {
      //find the parent in the list of items
      let parent = this.get('items').findBy('elementId', item.parent.elementId);
      parent.get('children').removeObject(item);
    } else {
        this.get('items').removeObject(item);
    }

  },



  /**
    009.1: cache the original position of the first sortable-item within the group to a private variable the sortable-group for reference: sortable-group.this._itemPosition
    -Called during _startDrag(event) in sortable-item component.
  **/

  prepare() {
    this._itemPosition = this.get('itemPosition');
  },

  /**
    015: cache the position of the first sortable item in sortable-group
  **/

  itemPosition: computed(function() {
    //returns x or y
    let direction = this.get('direction');

    /*
      sortedItems is an Ember array.
          - get the "y" property of the first sortable-item component. "y" was set during the sortable-item drag event.
          - spacing is ZERO by default. "Additional spacing between active item and the rest of the elements."
          - we'll just ignore the spacing property for now, because it doesn't quite work so well.
    */
    return this.get(`sortedItems.firstObject.${direction}`) - this.get('sortedItems.firstObject.spacing');
  }).volatile(), //computed property, so don't cache.


  /**
      014.5: Ah, brilliant. It sorts by the Y position of the sortable-item!
          The sortable-item Y position is computed as this.element.offsetTop by default.
          If the sortable-item is being dragged, Y position is: it's original this.element.offsetTop + or - the distance the mouse moved
  **/

  sortedItems: computed(function() {
    let items = a(this.get('items'));
    let direction = this.get('direction');

    //sort the parentnodes
    items = items.sortBy(direction);

    //check each parent node for children
    items.forEach(item => {
      //if this item has children
      if(item.get('children'))
      {
        //sort the children
        item.set('children', this.sortChildren(item.get('children'), direction));
      }
    });

    return items;
  }).volatile(),


  sortChildren(children, direction){
    //sort the children by y position
    children = children.sortBy(direction);

    //recursive children
    children.forEach(item => {
      if(item.get('children'))
      {
        item.set('children', this.sortChildren(item.get('children'), direction));
      }
    });

    return children;
  },


  //set the current mouse position on each mousemove event
  setCurrentPosition(xpos, ypos){
      this.set('currentMousePosition', {x:xpos, y:ypos});
  },

  //recursive search to see if object has child with the following key/value.
  hasChild(item, key, value)
  {
    //Get the children. If we are checking the group, then we need the list of items as children. Otherwise we are checking the sort-itmes children
    var children = (item.get('children') === undefined ? this.get('items') : item.get('children') );

    //init
    var hasChildCount = 0;

    //does this item have any children?
    if(children && children.length > 0)
    {
      //console.log("children.length = "+children.length);
      children.forEach(child => {

        if(child.get(key) === value)
        {
          hasChildCount++;
        }

        //if this item has children (recursive)
        if(child.get('children') && child.get('children').length > 0)
        {
          //recursive children
          child.get('children').forEach(childItem => {
              hasChildCount = hasChildCount + this.hasChild(childItem, key, value);
          });
        }
      });
    }
    return hasChildCount;
  },


   isDropTarget(component){
     let x = this.get('currentMousePosition').x,
     y = this.get('currentMousePosition').y;

     if (!get(component, 'isBusy')) {

           let item = '#' + component.get('elementId');

           //http://stackoverflow.com/questions/12396635/crossing-over-to-new-elements-during-touchmove
           //If the dragged object is within bounds on the component, the add a class that it is a valid drop target.
           if (!(
         x <= $(item).offset().left || x >= $(item).offset().left + $(item).outerWidth() ||
         y <= $(item).offset().top  || y >= $(item).offset().top + $(item).outerHeight()
           )) {

             //$(item).addClass('sortable-pending-target'); //for testing
             set(component, 'pendingDropTarget', true);
             this.activeDropTargets.pushObject(component);

           } else {
             //$(item).removeClass('sortable-pending-target'); //for testing
             set(component, 'pendingDropTarget', false);
             set(component, 'activeDropTarget', false);
             $(item).removeClass('sortable-activeDropTarget');
             this.activeDropTargets.removeObject(component);
           }
     }

     //recursive children
     //only if the component has children, and a count more than zero. sortable-group doesn't have a children property, so will fail the first test.
     if(component.get('children') && component.get('children').length > 0)
     {
       component.get('children').forEach(child => {
            this.isDropTarget(child);
       });
     }


   },

   findDropTarget() {
    //create an array of the possible drop areas
    let sortItems = a();
    sortItems.pushObjects(this.get('items')); //grab our list of sortable-items
    sortItems.pushObject(this); //push this sortable-group into the list

    /* Note:: Wierd error
          -Had previously tried the below configuration
          -But resulted in a wierd loop, where this.get('items') would receive (this) pushed to it on each loop and went crazy!
          -Even though I think I'm adding to a copy, it was referencing the original this.get('items'), which we logged in the update() function.

                let sortItems = a(this.get('items')); //we used to be just looking at groups, now we are looking at items
                sortItems.pushObject(this);// push this group into our items to check.
    */

    this.activeDropTargets = Ember.A();

    //http://stackoverflow.com/questions/18804592/javascript-foreach-loop-on-associative-array-object
    sortItems.forEach(component => {

          //check if this item and their children are drop targets
          this.isDropTarget(component);

    });


    //now check and see if there are more than one drop target (nested groups)
    if (this.activeDropTargets.length > 1)
    {
      this.activeDropTargets.forEach((component, index, enumerable) => {
        let item = '#' + component.get('elementId');

        //if there are more than zero childs with the following properties
        if( this.hasChild(component, 'pendingDropTarget', true) > 0)
        {
          //this element has a child with pendingDropTarget=true, skip.
          $(item).removeClass('sortable-activeDropTarget');
          //set this component's activeDropTarget property to false.
          set(component, 'activeDropTarget', false);
          return;
        } else {
          //set this component's activeDropTarget property to true.
          set(component, 'activeDropTarget', true);
          //give the group a record of what the activeDropTargetComponet is.
          this.set('activeDropTargetComponent', component);
        }
      });
    } else if (this.activeDropTargets.length === 1) {
      //there is only element in the array, which is the only possible drop target
      //set this component's activeDropTarget property to true.
      set(this.activeDropTargets[0], 'activeDropTarget', true);
      //give the group a record of what the activeDropTargetComponet is.
      this.set('activeDropTargetComponent', this.activeDropTargets[0]);
    } else {
      //error, no dropTarget found. We can be inbetween drop targets at this point
      this.set('activeDropTargetComponent', null);
    }

    //Indicate which is the active group in CSS. If null/false then we are inbetween the groups
    if(this.activeDropTargetComponent)
    {
      $('#' + this.activeDropTargetComponent.get('elementId')).addClass('sortable-activeDropTarget');
    }

    return this.activeDropTargetComponent;
  },

  /**
    014: Update the group.
          --Called on each mouse move and during drop event.
          --During mouseMove this event is throttled and updated every 125ms.

          Previous to this, all that has been accomplished is drag the element using css transform. Nothing else has been updated.

  **/
  update() {
     /**
        !!!!! Important !!!!
        014.5: Sort the sortable-items within the sortable-group based on their Y position.
            --these were added to the list during the "registerItem" event, called during didInsertElement in the sortable-item

            --The sortable-item Y position is computed as this.element.offsetTop by default.
            --If the sortable-item is being dragged, Y position is: it's original this.element.offsetTop + or - the distance the mouse moved
            --Once this sorting command is run, the objects are in perfect order.
    **/
    let sortedItems = this.get('sortedItems'); //includes sorting of children.

    let findDropTarget = this.findDropTarget();


    /******************

      Insert logic.

        TODO:
            -Get sorting working within the folder first.
            -Give each sortable-item/group it's own offsettop property for storing on init or first run.
            -Get the API update call working with appropriate parent information.


        Step #1 - Get the target of the sorting.

        Step #2 - Find out how to reposition nested items.
                      -Maybe we can do our recursive child loop trick.

        3? - If drop target isn't root, then we should make the spacer inside the drop target.


                Get the target of the sorting. If it is root or if it is a child.

                We can't use this._itemPosition, we'll have to get another one for the child.

                Maybe sortable-item should be aware of where it is, and then grab a new _itemPosition of first element when it swaps into a new child/parent.

    *******************/


    /* Cached position of the first sortable-item in group. Value never changes.
          -This will be used as the first position of the sortable-item in the group, regardless of their order.

      Set during _startDrag() event that runs once when the user clicks and starts to move.
        this._tellGroup('prepare');, which then gets this.get('itemPosition');
           See step # 015
    */
    let position = this._itemPosition;

    // Just in case we haven’t called prepare first.
    if (position === undefined) {
      position = this.get('itemPosition');
    }

    console.log("root position = "+position);

    /*
     * Position of the dragged item is updated prior to this. It is relative to the actual position in the dom.
     * So if you drag it to the top, it will be the first item, or second etc.
     */
     this.coordinateRecursiveUpdate(sortedItems, position);

  },


  coordinateRecursiveUpdate(sortedItems, position) {

    var i = 0; //for test
    sortedItems.forEach(item => {
      position = this.updateEachSortItem(item, position);

      //for test
      if(item.get('parent') && i == 0)
      {
        //console.log("setting "+item.elementId+" y pos="+position);
        i++;
      }
      //console.log("updating position for: "+item.get('elementId'));

      //if this item has children (recursive)
      if(item.get('children') && item.get('children').length > 0)
      {
        //sort the children by y position.


        //Get the offset top position of the first element. Taken from this.get('itemPosition').

        var childPosition = item._childPosition;

        // Initialize this position on the first run.
        if (childPosition === null) {
          //returns x or y
          let direction = this.get('direction');

          /*
            sortedItems is an Ember array.
                - get the "y" property of the first sortable-item component. "y" was set during the sortable-item drag event.
                - spacing is ZERO by default. "Additional spacing between active item and the rest of the elements."
                - we'll just ignore the spacing property for now, because it doesn't quite work so well.
          */
          childPosition = item.get(`children.firstObject.${direction}`) - item.get('children.firstObject.spacing');

          //save to the component private variable.
          set(item, '_childPosition', childPosition);
        }

        //recursive children
        this.coordinateRecursiveUpdate(item.get('children'), childPosition);
      }

    });

  },

  updateEachSortItem(item, position) {
    let dimension;
    let direction = this.get('direction');

    //if it is not the element being dragged adjust it's position.
    //if it is the very first element, then it's position is the same. We just grabbed the position of the first element above with position = this.get('itemPosition');
    if (!get(item, 'isDragging')) {
      set(item, direction, position);
    }

    // add additional spacing around active element
    //eg. 'isBusy' = computed.or('isDragging', 'isDropping'),
    if (get(item, 'isBusy')) {
      //we aren't using spacing right now, so position isn't modified.
      position += get(item, 'spacing') * 2;
    }

    if (direction === 'x') {
      dimension = 'width';
    }

    //We are going to adjust the position by the height of the sortable-item.
    if (direction === 'y') {
      dimension = 'height';
    }

    /**
      016: Now we are going to iterate to the next sortable-item in the list.
              Next item's position is going to be to relative to the current item.
                -below get(item, "height")  is constant alias for Ember.get()
                -sortable-item has a height() computer property.
     **/
    return position += get(item, dimension);
  }



});
