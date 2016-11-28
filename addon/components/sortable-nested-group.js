import Ember from 'ember';
import layout from '../templates/components/sortable-nested-group';
import computed from 'ember-new-computed';
import {invokeAction} from 'ember-invoke-action';

const { A, Component, get, set, run } = Ember;
const a = A;
const NO_MODEL = {};

import SortableGroupComponent from './sortable-group';

/*
 * Note: debugger; will stop ember execution for debugging.
 *
 */

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
  overlapDraggedItem: null, //how much of this item overlaps with the dragged item. If more that 50% than it is the drop target.

  activeDropTargetComponent: null, //keep a record of what the active drop target in the group is.

  //array of pending drop targets
  activeDropTargets: computed(() => a()),

  currentlyDraggedComponent: null, //what component are we currently dragging?
  currentlyDraggedComponentPosition: null, //what is the position of the currently dragged component within the activeDropTarget area

  swapDropTarget: false,

  dropTarget: null, //dropTarget

  setCurrentlyDraggedComponent(component){
    this.set('currentlyDraggedComponent', component);
  },

  currentlyDropping: false, //current state of the group.

  setCurrentlyDropping(boolean){
    this.set('currentlyDropping', boolean);
  },

  didInsertElement() {
    //See ghost
    $( this.element ).css('position', 'relative');
  },

  createGhost(){

    //SORTABLE GROUP CSS must have position=relative for the ghost to work propery.
    //See did insert element.
    let width = $( this.currentlyDraggedComponent.element ).css('width'),
      height = $( this.currentlyDraggedComponent.element ).css('height'),
      //parse int converts from 19px to 19;
      top = $( this.currentlyDraggedComponent.element ).offset().top - (  parseInt($( this.currentlyDraggedComponent.element ).css('margin-top'))   +  $( this.element ).offset().top);

      this.currentlyDraggedComponent.ghostId = "sortable-ghost-"+this.currentlyDraggedComponent.get('model.id');

        //create the ghost object
        $( this.currentlyDraggedComponent.element ).clone().attr("id", this.currentlyDraggedComponent.ghostId).attr("style","position:absolute; background:purple; width:"+width+"; height:"+height+"; top:"+top+"px; z-index:5000;").addClass('is-dragging').appendTo( this.element );


    //change the opacity of the original object
    $( this.currentlyDraggedComponent.element ).css('opacity', 0.4);
  },


  destroyGhost(){
    $( "#"+this.currentlyDraggedComponent.ghostId ).remove();
    this.currentlyDraggedComponent.ghostId = null;
    $( this.currentlyDraggedComponent.element ).css('opacity', 1);
  },


  /**
    Register an item with this group.
    @method registerItem
    @param {SortableItem} [item]
  */
  /**
     001:  Runs during didInsertElement() in sortable-item
   **/
  registerItem(item) {
        //we only need to add the root level items.
        //we will registered the children as chilren of the componets in didInsertElement with registerChildren below
        if(item.parent === null)
        {
          //this item doesn't have any parents.
          //check and see if it has already been added
          if(this.get('items').findBy('elementId', item.elementId) === undefined)
          {
            //console.log("inserted "+item.elementId+"into root");
            this.get('items').addObject(item);
          } else {
            //item already exists
            //console.log(item.elementId+" already exists");
          }
        }
    },

    registerChildren(item){
      /* Note:
            http://stackoverflow.com/a/18843648
            It's important to understand what the = operator in JavaScript does and does not do.

            The = operator does not make a copy of the data.

            The = operator creates a new reference to the same data.
      */
      if(item.parent !== null)
      {
        item.parent.get('children').addObject(item);
      }
    },

/*
    console.log("start register completion");
    this.get('items').forEach(item => {
        if(item.get('children')){
              item.get('children').forEach(child => {
                console.log(item.elementId+child);
              });
        }
    });*/

  /**
    De-register an item with this group.
    @method deregisterItem
    @param {SortableItem} [item]
  */
  deregisterItem(item) {

    /*
     * Note:: We don't need to do recursion here, because "item.parent" is a reference to the actual component.
     * It is working list an alias. We can remove the object directly.
     *
     */

    if(item.parent !== null)
    {
      //find the parent in the list of items
      let parent = item.parent;

      if(parent && (parent.get('children') && parent.get('children').length > 0))
      {
        parent.get('children').removeObject(item);
      }
    } else {
        this.get('items').removeObject(item);
    }

  },


/*
  recursiveFindParent(component, items){

     var parent = items.findBy('elementId', component.parent.elementId);

     //if the parent hasn't been found already, let's check the children.
     if(!parent)
     {
       items.forEach(item => {
            parent = recursiveFindParent(component, item.get('children'));

            if(droppedItem !== false)
            {
              //we found the dropped item. break the forEach loop
              return;
            }
       });
     }

     return parent;
  }
*/

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
  hasChild(item, key, operand, value)
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

        //choose our selection criteria
        if(operand === '===')
        {
          if(child.get(key) === value)
          {
            hasChildCount++;
          }
        } else if(operand === '>='){
          if(child.get(key) >= value)
          {
            hasChildCount++;
          }
        } else if(operand === '<='){
          if(child.get(key) <= value)
          {
            hasChildCount++;
          }
        }


        //if this item has children (recursive)
        if(child.get('children') && child.get('children').length > 0)
        {
          //recursive children
          child.get('children').forEach(childItem => {
              hasChildCount = hasChildCount + this.hasChild(childItem, key, operand, value);
          });
        }
      });
    }
    return hasChildCount;
  },

  //recursive search to see if object has parent with the following key/value.
  hasParent(item, key, value)
  {
    //Get the parent
    var parent = item.get('parent');

    //init
    var hasParentCount = 0;

    //does this item have a parent?
    if(parent !== null && parent !== undefined)
    {
      //console.log("children.length = "+children.length);
      if(parent.get(key) === value)
      {
        hasParentCount++;
      }

      //if this item has parent (recursive)
      if(parent.get('parent') !== null)
      {
        //recursive parent
        hasParentCount = hasParentCount + this.hasParent(parent, key, value);
      }

    }
    return hasParentCount;
  },

  //http://stackoverflow.com/questions/4230029/jquery-javascript-collision-detection
  overlaps: (function () {
    function getPositions( elem ) {
        var pos, width, height;
        pos = $( elem ).offset();
        width = $( elem ).outerWidth();
        height = $( elem ).outerHeight();
        return [ [ pos.left, pos.left + width ], [ pos.top, pos.top + height ] ];
    }

    function comparePositions( p1, p2 ) {
        var r1, r2;
        r1 = p1[0] < p2[0] ? p1 : p2;
        r2 = p1[0] < p2[0] ? p2 : p1;
        return r1[1] > r2[0] || r1[0] === r2[0];
    }

    return function ( a, b ) {
        var pos1 = getPositions( a ),
            pos2 = getPositions( b );
        return comparePositions( pos1[0], pos2[0] ) && comparePositions( pos1[1], pos2[1] );
    };
})(),

   isDropTarget(component){

     //reset
     var item = '#' + component.get('elementId');
     set(component, 'overlapDraggedItem', null);
     set(component, 'pendingDropTarget', false);
     set(component, 'activeDropTarget', false);
     $(item).removeClass('sortable-activeDropTarget');
     this.activeDropTargets.removeObject(component);

     if (!get(component, 'isBusy') && !get(component, 'wasDropped')) {
           //http://stackoverflow.com/questions/12396635/crossing-over-to-new-elements-during-touchmove
           //If the dragged object is within bounds on the component, the add a class that it is a valid drop target.

           //if the dragged item overlaps with possible drop target
           //and it doesn't have a parent that is being dragged (otherwise the child of the dragged element can accidentally be seleted as drop target)
           if ( this.overlaps(this.currentlyDraggedComponent.ghostElement(), component.element) && this.hasParent(component, 'isBusy', true) == 0) {

             $(item).addClass('sortable-pending-target'); //for testing
             set(component, 'pendingDropTarget', true);
             this.activeDropTargets.pushObject(component);

           } else {
             $(item).removeClass('sortable-pending-target'); //for testing
             set(component, 'overlapDraggedItem', null);
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

   calculateOverlapArea(component, div2){

    var div1 = $(component.get('element'));

    var l1=div1.offset().left;
    var t1=div1.offset().top;
    var w1=div1.outerWidth();
    var h1=div1.outerHeight();

    var l2=div2.offset().left;
    var t2=div2.offset().top;
    var w2=div2.outerWidth();
    var h2=div2.outerHeight();

    var top = Math.max(t1,t2);
    var left = (l2>l1 && l2<(l1+w1)) ? l2 : (l1>l2 && l1<(l2+w2)) ? l1 : 0;
    var width = Math.max(Math.min(l1+w1,l2+w2) - Math.max(l1,l2),0);
    var height = Math.max(Math.min(t1+h1,t2+h2) - Math.max(t1,t2),0);
    return {"component": component, "elementId": div1.attr('id'), "width": width, "height": height};
  },

   compareOverlap(a, b) {

      let overlapA = this.calculateOverlapArea($(a.get('element')), $(this.currentlyDraggedComponent.ghostElement())),
      overlapB = this.calculateOverlapArea($(b.get('element')), $(this.currentlyDraggedComponent.ghostElement()));

      let areaA = overlapA.width * overlapA.height,
      areaB = overlapB.width * overlapB.height;

      //console.log(overlapA.elementId+" = "+areaA+(this.elementId === overlapA.elementId ? " is ROOT" : ''));
      //console.log(overlapB.elementId+" = "+areaB+(this.elementId === overlapB.elementId ? " is ROOT" : ''));

      if(areaA > areaB)
      {
        return a;
      } else {
        return b;
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
    this.activeDropTargetComponent = null; //reset

    //http://stackoverflow.com/questions/18804592/javascript-foreach-loop-on-associative-array-object
    sortItems.forEach(component => {

          //check if this item and their children are drop targets
          this.isDropTarget(component);

    });


//REVISIONS:::
//Find the objects with pendingDropTarget.
//then calculate which object has overlap > 50%.  that is 50% of the dragged item.
//-----or if the middle point of the dragged object (50%) is inside the drop target.
//----or just the drop target which has more overlap with dragged object.

//compare items in activeDropTargets


    //now check and see if there are more than one drop target (nested groups)
    if (this.activeDropTargets.length > 1)
    {
      var overlapCalculations = a();

        //console.log("------List of active DropTargets-----");
      this.activeDropTargets.forEach((component, index, enumerable) => {
            let item = '#' + component.get('elementId');


            //how much of this component is covered by the dragged item?
            component.set('overlapDraggedItem', this.calculateOverlapArea(component, $(this.currentlyDraggedComponent.ghostElement())));

            //show elementID and the amount of overlap.
            //console.log(component.get('elementId')+" overlap="+component.get('overlapDraggedItem.height'));

      });


      //if the target is a child, the parent and root will always have 100% overlap.
      //in these cases, you need to look and see if the child has more than 50%, otherwise drop area is parent or root
      let sortByOverlap = this.activeDropTargets.sortBy('overlapDraggedItem.height').reverse(); //descending order

      var draggedItemHeight = $(this.currentlyDraggedComponent.ghostElement()).outerHeight();

      //find the activeDrop target by sorting through the drop targets starting with the components with the most overlap.
      sortByOverlap.forEach(component => {
        //if we've already found the drop target, skip checking the items with smaller overlap.
        if (this.get('activeDropTargetComponent') !== null)
        {
          //console.log("skipping");
          return;
        }

        //does this item have 100% overlap?
        //it is either root or a parent.
        if(component.get('overlapDraggedItem.height') === draggedItemHeight)
        {
          //do we have a child with 100% overlap?
          //hasChild returns a count of children meeting the criteria
          if( this.hasChild(component, 'overlapDraggedItem.height', '===', draggedItemHeight) > 0)
          {
            //if we have a child with 100% overlap, then we are inside a parent node (folder).
            //console.log(component.get('elementId')+" HAS A CHILD WITH 100% OVERLAP!");

            $(component.get('element')).removeClass('sortable-activeDropTarget');
            $(component.get('element')).removeClass('sortable-pending-target'); //for testing
            //set this component's activeDropTarget property to false.
            set(component, 'activeDropTarget', false);
            //remove this component from the list of activeDropTargets (pending)
            this.activeDropTargets.removeObject(component);
            return;
          } else if( this.hasChild(component, 'overlapDraggedItem.height', '>=', (draggedItemHeight / 2)) > 0) {
            //this component has 100% overlap, and HAS a recursive child component with 50% or more overlap
            //this component is not the drop target
            $(component.get('element')).removeClass('sortable-activeDropTarget');
            $(component.get('element')).removeClass('sortable-pending-target'); //for testing
            //set this component's activeDropTarget property to false.
            set(component, 'activeDropTarget', false);
            //remove this component from the list of activeDropTargets (pending)
            this.activeDropTargets.removeObject(component);
            return;
          } else if( this.hasChild(component, 'overlapDraggedItem.height', '>=', (draggedItemHeight / 2)) === 0) {
            //this component has 100% overlap, and has NO recursive child components with 50% or more overlap
            //this component must be the drop target.
            set(component, 'activeDropTarget', true);
            //give the group a record of what the activeDropTargetComponet is.
            this.set('activeDropTargetComponent', component);
          }
        } else {
          //evaluate components that do not have 100% overlap.
          if( component.get('overlapDraggedItem.height') >= (draggedItemHeight / 2) ) {
            //this component has 100% overlap, and has NO recursive child components with 50% or more overlap
            //this component must be the drop target.
            set(component, 'activeDropTarget', true);
            //give the group a record of what the activeDropTargetComponet is.
            this.set('activeDropTargetComponent', component);
          }

        }

      });


/*
        //if there are more than zero childs with the following properties
        if( this.hasChild(component, 'pendingDropTarget', true) > 0)
        {
          //this element has a child with pendingDropTarget=true, skip.
          $(item).removeClass('sortable-activeDropTarget');
          $(item).removeClass('sortable-pending-target'); //for testing
          //set this component's activeDropTarget property to false.
          set(component, 'activeDropTarget', false);
          //remove this component from the list of activeDropTargets (pending)
          this.activeDropTargets.removeObject(component);
          return;
        } else {

          //now we have viable drop targets (as we could be overlapping multiple)
          //find out which element has more overlap.
          if (this.activeDropTargets.length === 2)
          {
            //console.log("there are two drop targets to decide between");
            let overlapTarget = this.compareOverlap(this.activeDropTargets[0],this.activeDropTargets[1]);

            //set this component's activeDropTarget property to true.
            set(overlapTarget, 'activeDropTarget', true);
            //give the group a record of what the activeDropTargetComponet is.
            this.set('activeDropTargetComponent', overlapTarget);
          } else {
            //DEFAULT: Just go with the last item in the list.

            //set this component's activeDropTarget property to true.
            set(component, 'activeDropTarget', true);
            //give the group a record of what the activeDropTargetComponet is.
            this.set('activeDropTargetComponent', component);
          }
        }
      });
*/
        //console.log("------END  of active DropTargets-----");
    } else if (this.activeDropTargets.length === 1) {
      //there is only element in the array, which is the only possible drop target
      //set this component's activeDropTarget property to true.
      set(this.activeDropTargets[0], 'activeDropTarget', true);
      //give the group a record of what the activeDropTargetComponet is.
      this.set('activeDropTargetComponent', this.activeDropTargets[0]);
    } else {
      //error, no dropTarget found. We must be above or below the drop area, set it to root.
      this.set('activeDropTargetComponent', this);
    }

    //Indicate which is the active group in CSS. If null/false then we are inbetween the groups
    if(this.activeDropTargetComponent)
    {
      $(this.activeDropTargetComponent.get('element')).addClass('sortable-activeDropTarget');
    }

    return this.activeDropTargetComponent;
  },



  isSwap(){
    this.dropTarget = this.findDropTarget();

    //get the parent component of the currently dragged item. If there is no parentId, then it is root and the sortable-group is the parent.
    let draggedComponentParent = ( this.currentlyDraggedComponent.get('parent') !== null ? this.currentlyDraggedComponent.get('parent') : this);

    //reset
    this.swapDropTarget = false;

    //dropTarget can be undefined if we are dragging out of bounds. Must check or we error.
    if(this.dropTarget && (draggedComponentParent.get('elementId') !== this.dropTarget.get('elementId')))
    {
      //if the dragged components parent element, is not the same as the drop target then we need to move this object to a different depth.
      this.swapDropTarget = true;
    }

  },

  //what is the position of the currently dragged component within the activeDropTarget area
  draggedItemNodePosition(){


      let draggedElement = $(this.currentlyDraggedComponent.ghostElement()),
          //drop target can be undefined if we are dragged outside of the sortable-group, so use root/sortable-group
          dropTargetElement = (this.activeDropTargetComponent ? $(this.activeDropTargetComponent.get('element')) : $(this.get('element')));

      //offset uses position relative to the document
      let offset = draggedElement.offset().top - dropTargetElement.offset().top;

      //get the position relative to the parent node.
      this.currentlyDraggedComponentPosition = offset;
  },


  /**
    014: Update the group.
          --Called on each mouse move and during drop event.
          --During mouseMove this event is throttled and updated every 125ms.

          Previous to this, all that has been accomplished is drag the element using css transform. Nothing else has been updated.

  **/
  update() {

    this.isSwap();

    //what is the position of the currently dragged component within the activeDropTarget area
    this.draggedItemNodePosition();

      //let's trying doing something else on update instead of the usual.

      /******************************/
        //NEW UPDATE STYLE.

        //if collission of more than 33% of underneath element, transform it to move the outerHeight of the dragged element (height+margin);

        //USE the middle of the dragged item??

        //As soon as the object collides, nested drop target should be eligible.

        //IF more than 50% of the object is in the drop area.


        //++ for UPDATE:: If more that 50% of the underneath object is covered by the dragged object, it should move out of the way.
        //we can also change the height of dropped elements to fit the new one.

        //return;
      /******************************/


    //if we are swapping, the models will be updated in commit.
    //stop display of wrong position.
    if(this.swapDropTarget == true && this.currentlyDropping == true)
    {
      //this.currentlyDraggedComponent.set('isVisible', false);
    }

    /******************

      Insert logic.


        MOVE ELEMENT JQUERY STYLE:
        http://stackoverflow.com/a/19802593

        jQuery("#NodesToMove").detach().appendTo('#DestinationContainerNode')
COPY:

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



    /**
         !!!!! Important !!!!
         014.5: Sort the sortable-items within the sortable-group based on their Y position.
             --these were added to the list during the "registerItem" event, called during didInsertElement in the sortable-item

             --The sortable-item Y position is computed as this.element.offsetTop by default.
             --If the sortable-item is being dragged, Y position is: it's original this.element.offsetTop + or - the distance the mouse moved
             --Once this sorting command is run, the objects are in perfect order.
     **/
     let sortedItems = this.get('sortedItems'); //includes sorting of children.


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

    /*
     * Position of the dragged item is updated prior to this. It is relative to the actual position in the dom.
     * So if you drag it to the top, it will be the first item, or second etc.
     */

     this.coordinateRecursiveUpdate(sortedItems, position);

  },


  coordinateRecursiveUpdate(sortedItems, position) {

    var i = 0; //for test
    sortedItems.forEach((item, index, sortedItems) => {
      position = this.updateEachSortItem(item, position, index, sortedItems);

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
        //this.coordinateRecursiveUpdate(item.get('children'), childPosition);
      }

    });

  },


  findPreviousItemNotDraggedScope(sortedItems, index){

    //sortedItems.length;  //10

    var count = index; //4

    var previousItem = false;

    while (count >= 0)
    {
      //previous item
      count = count - 1;
      previousItem = sortedItems.objectAt(count);

      if(previousItem && previousItem.get('isDragging') === false)
      {
        //return this item
        break;
      } else {
        previousItem = false;
      }

    }

    return previousItem;
  },

  makeSpacerForDraggedObject(item, position, index, sortedItems, draggedPosition, itemParent, dimension){

    let prevItem = this.findPreviousItemNotDraggedScope(sortedItems, index);

    //ISSUE IS that when we compare Y it was it's old position. just used for sorting.
    //We need to compare POSITION which is it's new position.


    //position of where we'd be if we insert the draggedComponentSpacer
    let futurePosition = item.get('y') + this.currentlyDraggedComponent.get(dimension);

    //if this item's parent is in the same node as the drop target, insert a space for the ghost object and don't move it.
    if(itemParent === this.activeDropTargetComponent)
    {
      //this.currentlyDraggedComponent._originalOffset


      console.log("matched makeSpacerForDraggedObject="+index);
      return false;
      //return true;
    }

    console.log("failed makeSpacerForDraggedObject on index = "+index);
    return false;
  },

  updateEachSortItem(item, position, index, sortedItems) {
    //index is the array index of the items we are looping through
    let dimension;
    let direction = this.get('direction');

    if (direction === 'x') {
      dimension = 'width';
    }

    //We are going to adjust the position by the height of the sortable-item.
    if (direction === 'y') {
      dimension = 'height';
    }







    //if the item parent is null, that means it is a root element, and needs the sortable-group manually assigned as its parent component
    if(item.get('parent') !== null)
    {
      var itemParent = item.get('parent');
      //var draggedPosition = this.currentlyDraggedComponentPosition + item.get('_childPosition');
    } else {
      //is the root node
      var itemParent = this;
      //var draggedPosition = this.currentlyDraggedComponentPosition + this.get('_itemPosition');
    }

var draggedPosition = $(this.currentlyDraggedComponent.ghostElement()).offset().top;

let futurePosition = position + this.currentlyDraggedComponent.get(dimension);

    console.log(index + item.get('elementId') + " this.currentlyDraggedComponentPosition="+this.currentlyDraggedComponentPosition+"  draggedPosition="+draggedPosition+" item.element.offsetTop"+item.element.offsetTop+" item.y"+item.get('y')+" this._itemPosition"+this._itemPosition+" position="+position+" futureposition="+(position + this.currentlyDraggedComponent.get(dimension))+" bottomEdge="+(item.get('y') + item.get(dimension)) + " item original offset = "+item._originalOffset+" ydrag="+item._ydrag);



    /*
     *
     *
     *
     *
     */


    //adjust the position of every element, except for the dragged object.
    if(!get(item, 'isDragging'))
    {
        if(this.makeSpacerForDraggedObject(item, position, index, sortedItems, draggedPosition, itemParent, dimension))
        {
          //draggedPosition >= position && draggedPosition < nextItem.get(direction)

          //increase the position by the height of the dragged component
          position += this.currentlyDraggedComponent.get(dimension);

          set(item, direction, position);

          //now add the height of this item for the next loop
          position += get(item, dimension);

        } else {
          //set the position of the item, then increment the next one by the height of this item
          set(item, direction, position);
          position += get(item, dimension);
        }

    }



    // add additional spacing around active element
    //eg. 'isBusy' = computed.or('isDragging', 'isDropping'),
    if (get(item, 'isBusy')) {
      //we aren't using spacing right now, so position isn't modified.
      position += get(item, 'spacing') * 2;
    }






/*
    //is this item at the same depth as the dragged item?
    //eg. are both the dragged item and this item within the drop area?
    if(itemParent === this.activeDropTargetComponent && !get(item, 'isDragging'))
    {



    } else {
      //update children or other nodes that aren't in the drop area

      //if it is not the element being dragged adjust it's position.
      //if it is the very first element, then it's position is the same. We just grabbed the position of the first element above with position = this.get('itemPosition');
      if (!get(item, 'isDragging')) {
        console.log("else "+index);
        set(item, direction, position);
      }

      //if we are iterating over the dragged item, don't adjust the position tree.
      //we'll adjust it later.
      if (!get(item, 'isDragging')) {
        position += get(item, dimension);
      }
    }

*/









    /**
      016: Now we are going to iterate to the next sortable-item in the list.
              Next item's position is going to be to relative to the current item.
                -below get(item, "height")  is constant alias for Ember.get()
                -sortable-item has a height() computer property.
     **/







    return position;
  },


  //search for the dropped item
  findDroppedItem(items) {
    var droppedItem = false;

    if(items.findBy('wasDropped', true))
    {
      return items.findBy('wasDropped', true);
    }

    items.forEach(item => {

      //if this item has children (recursive)
      if(item.get('children') && item.get('children').length > 0)
      {
        //recursive children
        var search = this.findDroppedItem(item.get('children'));

        if(search !== false && search !== undefined)
        {
          //we found the dropped item.
          droppedItem = search;

        }
      }
    });

    return droppedItem;
  },


/*
items.forEach((component, index) => {
  if(component.get('children') && component.get('children').length > 0)
  {
    //map the children models for this item
    itemModels[index].set('children', this.mapChildrenModels(component.get('children')));
  }
});
*/

  mapChildrenModels(children){

      let models = children.mapBy('model');

      children.forEach((childComponent, index) => {
        //if this component has children
        if(childComponent.get('children') && childComponent.get('children').length > 0)
        {
          //recursive children
          //map the children models for this item
          this.mapChildrenModels(childComponent.get('children'));
          models[index].set('children', this.mapChildrenModels(childComponent.get('children')));
        }

      });

      return models;
  },


  recursiveInvoke(items, command){

    items.invoke(command);

    items.forEach(item => {

      //if this item has children (recursive)
      if(item.get('children') && item.get('children').length > 0)
      {
        //recursive children
        this.recursiveInvoke(item.get('children'), command);
      }
    });

  },


  deleteChildPositions(items){

    items.forEach(item => {
      //clear the position
      set(item, '_childPosition', null);

      //if this item has children (recursive)
      if(item.get('children') && item.get('children').length > 0)
      {
        //recursive children
        this.deleteChildPositions(item.get('children'));
      }
    });


  },

  //remove the component's model from the parent's children model
  deleteChildModel(component){
    let parentChildren = component.get('parent.model.children');
    let componentModel = component.get('model');

    //if the dragged component was a child of a parent model
    if(parentChildren)
    {
      parentChildren.removeObject(componentModel);
    }

  },

  addChildModel(component){
    let parentModel = component.get('parent.model');
    let componentModel = component.get('model');

    if(parentModel)
    {
      //add the model to the parent's children. Shouldn't matter if it is empty, because we are adding.
      //when children is empty it's just an empty array.
      if(parentModel.get("children"))
      {
        parentModel.get("children").addObject(componentModel);
      }
    }
  },

  swap(dropTarget) {
      //remove the currently dragged component from the group's 'items' list
      //also removes the component from the parent's children list.
      this.deregisterItem(this.currentlyDraggedComponent);
      //IMPORTANT:: Looks like we can't delete the child model from a component, because it's that model that was used to generate the component itself! You'll end up deleting the component in the process.

      //YES, ON DRAG or UPDATE that may be the case, but we can delete the model on COMMIT (DROP)!!!
      //try deleting the model from parent's model.children.
      this.deleteChildModel(this.currentlyDraggedComponent);



      //set the parent for the currentlyDraggedComponent to its drop target
      //evaluate if the drop target is the root element (sortable-nested-group)
      if(this === dropTarget)
      {
        //if the target is root, the the component has no parent.
        set(this.currentlyDraggedComponent, 'parent', null);
      } else {
        //set the parent to the drop area target component
        set(this.currentlyDraggedComponent, 'parent', dropTarget);
      }


      //now register the dragged component back to this.'items'
      //this will also update the appropriate parent component with this item as its child.
      this.registerItem(this.currentlyDraggedComponent);
      this.registerChildren(this.currentlyDraggedComponent);

      //add the model to parent model if applicable
      this.addChildModel(this.currentlyDraggedComponent);

      //move the draggedComponent to its correct location in the dom
      //$('#'+this.currentlyDraggedComponent.get('elementId')).detach().appendTo('#'+dropTarget.get('elementId'));

      //maybe now I need to reset the offset.top! or


              //Testing: Shows the new component items tree.
              /*
                  this.get('items').forEach(item => {
                    console.log(item.elementId);
                    console.log(item.model);
                      if(item.get('children')){
                            item.get('children').forEach(child => {
                              console.log(item.elementId+child.elementId);
                              console.log(child.model);
                                if(child.get('children')){
                                      child.get('children').forEach(child2 => {
                                        console.log(child2.model);
                                      });
                                }

                            });
                      }
                  });*/



    },

  /**
    @method commit
  */
  /**
    019:   Commit the dropped item.
              Sort is already complete by "update" above.
   **/
  commit() {
      //swap the drop target
      if(this.swapDropTarget == true)
      {

        console.log("item tree before drop (update)");
        this.get('sortedItems').forEach(item => {
          console.log(item.elementId+" y="+item.get('y'));
          //console.log(item);
            if(item.get('children')){
                  item.get('children').forEach(child => {
                    console.log(item.elementId+child.elementId+" y="+child.get('y'));
                    //console.log(child);
                      if(child.get('children')){
                            child.get('children').forEach(child2 => {
                              console.log(item.elementId+child.elementId+child2.elementId+" y="+child2.get('y'));
                              //console.log(child2);
                            });
                      }

                  });
            }
        });

        //run swap to move dragged item into this target
        this.swap(this.dropTarget);



        //set the private _y property directly, as settig y on it's own triggers the CSS transform, which isn't what we need.
        //http://stackoverflow.com/questions/4249648/jquery-get-mouse-position-within-an-element

        console.log(this.currentlyDraggedComponent.get('height'));
        //i don't know why, but if swapping into root, the yPosition needs to have the height of the dragged element to it.
        let yPosInsideElement = (this === this.dropTarget ? this.currentlyDraggedComponent.get('height') : 0) + this.get('currentMousePosition').y - this.dropTarget.get('element.offsetTop');
        this.currentlyDraggedComponent.set('_y', yPosInsideElement);
      }

      /*  TO DO
       *
       *  We need to send an accurate itemModels back to the route. Need to ensure the children of the last position are updated.
       *     -Delete the item from previous node. Either root, or children. ***Maybe we only need to do it on children level.***
       *     -Maybe the child component is still listed under the parent component, may have nothing to do with model.
       *
       *  Maybe we can update the sort-item drag to operate on different levels. It should detect what element it is inside and then
       *  insert the ghost element/push the others out of the way.
       *
       *  Turn on model refreshing later.
       *
       */






    //get the list of sorted sortable-item components.
    let items = this.get('sortedItems'); //component classes, sorted in the new order.

    //get the original ember model assigned to sortable-group.
    //we don't manipulate this model directly, and send it back in the callback as is.
    let groupModel = this.get('model'); //model objects

    /*******

      Insert logic here.

            Above sorts the entire model.

                If we are sorting a child, add a few extra steps to sort that.

    ********/

    let itemModels = items.mapBy('model'); //returns the model of each component, in sorted order.
    //http://emberjs.com/api/classes/Ember.Array.html#method_mapBy

    //recursively map the children models.
    items.forEach((component, index) => {
      if(component.get('children') && component.get('children').length > 0)
      {
        //map the children models for this item
        itemModels[index].set('children', this.mapChildrenModels(component.get('children')));
      }
    });

    //grab the sortable-item component class that was dropped
    let draggedItem = this.findDroppedItem(items);

    console.log("did we find the dragedItem??=="+draggedItem);
    let draggedModel;

    //can we find the item that was dropped?
    if (draggedItem) {
      //reset the sortable-item component
      set(draggedItem, 'wasDropped', false); // Reset
      //grab the model of the sortable-item for the onChange callback.
      draggedModel = get(draggedItem, 'model');
    }





        console.log("current mouse position = "+this.get('currentMousePosition').y);

        //default this._y = this.element.offsetTop;
        console.log("dragged item offsetTop = "+this.currentlyDraggedComponent.element.offsetTop);

        console.log("item tree after drop (update)");
        this.get('sortedItems').forEach(item => {
          console.log(item.elementId+" y="+item.get('y')+" offset="+item.element.offsetTop);
          //console.log(item);
            if(item.get('children')){
                  item.get('children').forEach(child => {
                    console.log(item.elementId+child.elementId+" y="+child.get('y')+" offset="+child.element.offsetTop);
                    //console.log(child);
                      if(child.get('children')){
                            child.get('children').forEach(child2 => {
                              console.log(item.elementId+child.elementId+child2.elementId+" y="+child2.get('y'));
                              //console.log(child2);
                            });
                      }

                  });
            }
        });

        //debugger;





    //delete cache the original position of the first sortable-item within the group
    //this is set during _startDrag(event) in sortable-item component. drag is complete, we don't need it anymore.
    delete this._itemPosition;
    this.deleteChildPositions(items); //recursive delete cached positions of childs.

    //reset
    console.log("drop target on commit="+this.dropTarget.get('elementId'));
    $('#'+this.dropTarget.get('elementId')).removeClass('sortable-activeDropTarget');

    this.dropTarget = null;
    this.swapDropTarget = false;
    this.set('currentlyDraggedComponent', null);







    //ED TODO:: Delete all of the sortable-items childPosition caches.

    /**
      020: Run some functions on each sortable-item components
      http://emberjs.com/api/classes/Ember.Array.html#method_invoke
        Invokes the named method on every object in the receiver that implements it.
    **/


    //run sortable-item.freeze();
    //set css transition to none.
    run.schedule('render', () => {
      this.recursiveInvoke(items, 'freeze');
    });

    //delete this._y of sortable-item. It needs to init new y position on the next startDrag, as everything has moved.
    //removes transform.
    run.schedule('afterRender', () => {
      this.recursiveInvoke(items, 'reset');
    });

    //removes transform again.
    run.next(() => {
      run.schedule('render', () => {
        this.recursiveInvoke(items, 'thaw');
      });
    });

    if (groupModel !== NO_MODEL) {
      invokeAction(this, 'onChange', groupModel, itemModels, draggedModel, draggedItem); //add the draggedItem Component
    } else {
      invokeAction(this, 'onChange', itemModels, draggedModel);
    }
  }



});
