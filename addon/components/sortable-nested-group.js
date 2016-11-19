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

  activeDropTargetComponent: null, //keep a record of what the active drop target in the group is.

  //array of active drop targets
  activeDropTargets: computed(() => a()),

  currentlyDraggedComponent: null, //what component are we currently dragging?

  setCurrentlyDraggedComponent(component){
    this.set('currentlyDraggedComponent', component);
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

     //reset
     var item = '#' + component.get('elementId');
     set(component, 'pendingDropTarget', false);
     set(component, 'activeDropTarget', false);
     $(item).removeClass('sortable-activeDropTarget');
     this.activeDropTargets.removeObject(component);

     if (!get(component, 'isBusy') && !get(component, 'wasDropped')) {
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
      console.log("parent children before>");
      parentModel.get("children").forEach(child => {
        console.log(child.id);
      });

      //add the model to the parent's children. Shouldn't matter if it is empty, because we are adding.
      //when children is empty it's just an empty array.
      if(parentModel.get("children"))
      {
        parentModel.get("children").addObject(componentModel);
      }

      console.log("parent children after>");
      parentModel.get("children").forEach(child => {
        console.log(child.id);
      });
    } else {
      console.log("this component has no parent!");
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
    let dropTarget = this.findDropTarget();

    //get the parent component of the currently dragged item. If there is no parentId, then it is root and the sortable-group is the parent.
    let draggedComponentParent = ( this.currentlyDraggedComponent.get('parent') !== null ? this.currentlyDraggedComponent.get('parent') : this);

    let swapDropTarget = false;

    //dropTarget can be undefined if we are dragging out of bounds. Must check or we error.
    if(dropTarget && (draggedComponentParent.get('elementId') !== dropTarget.get('elementId')))
    {
      //if the dragged components parent element, is not the same as the drop target then we need to move this object to a different depth.
      swapDropTarget = true;
    }


    if(swapDropTarget == true)
    {
      this.swap(dropTarget);


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
    }





    //get the list of sorted sortable-item components.
    let items = this.get('sortedItems'); //component classes, sorted in the new order.

    console.log(items.toArray());
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

    //delete cache the original position of the first sortable-item within the group
    //this is set during _startDrag(event) in sortable-item component. drag is complete, we don't need it anymore.
    delete this._itemPosition;
    this.deleteChildPositions(items); //recursive delete cached positions of childs.


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
