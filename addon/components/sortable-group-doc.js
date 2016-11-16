import Ember from 'ember';
import layout from '../templates/components/sortable-group-doc';
import computed from 'ember-new-computed';
import {invokeAction} from 'ember-invoke-action';

const { A, Component, get, set, run } = Ember;
const a = A;
const NO_MODEL = {};


/**
  Init: no functions are run by sortable-group. Everything seems to be triggered by sortable-item mixin
**/

export default Component.extend({
  layout: layout,

  /**
    @property direction
    @type string
    @default y
  */
  direction: 'y',

  /**
    @property model
    @type Any
    @default null
  */
  model: NO_MODEL,

  /**
    @property items
    @type Ember.NativeArray
  */
  items: computed(() => a()),

  /**
    Position for the first item.
    If spacing is present, first item's position will have to change as well.
    @property itemPosition
    @type Number
  */

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
    @property sortedItems
    @type Array
  */

  /**
      014.5: Ah, brilliant. It sorts by the Y position of the sortable-item!
          The sortable-item Y position is computed as this.element.offsetTop by default.
          If the sortable-item is being dragged, Y position is: it's original this.element.offsetTop + or - the distance the mouse moved
  **/

  sortedItems: computed(function() {
    let items = a(this.get('items'));
    let direction = this.get('direction');

    return items.sortBy(direction);
  }).volatile(),

  /**
    Register an item with this group.
    @method registerItem
    @param {SortableItem} [item]
  */
  /**
     001:  Runs during didInsertElement() in sortable-item
   **/
  registerItem(item) {
    this.get('items').addObject(item);
  },

  /**
    De-register an item with this group.
    @method deregisterItem
    @param {SortableItem} [item]
  */
  deregisterItem(item) {
    this.get('items').removeObject(item);
  },

  /**
    Prepare for sorting.
    Main purpose is to stash the current itemPosition so
    we don’t incur expensive re-layouts.
    @method prepare
  */

  /**
    009.1: cache the original position of the first sortable-item within the group to a private variable the sortable-group for reference: sortable-group.this._itemPosition
    -Called during _startDrag(event) in sortable-item component.
  **/

  prepare() {
    this._itemPosition = this.get('itemPosition');
  },

  /**
    Update item positions (relatively to the first element position).
    @method update
  */

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
    let sortedItems = this.get('sortedItems');


    /******************

      Insert logic.

            re: sortedItems
            let items = a(this.get('items'));

                Get the target of the sorting. If it is root or if it is a child.

                We can't use this._itemPosition, we'll have to get another one for the child.

                Maybe sortable-item should be aware of where it is, and then grab a new _itemPosition of first element when it swaps into a new child/parent.

    *******************/


    /* Cached position of the first sortable-item in group.
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
    sortedItems.forEach(item => {
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
      position += get(item, dimension);
    });
  },

  /**
    @method commit
  */


  /**
    019:   Commit the dropped item.
              Sort is already complete by "update" above.
   **/
  commit() {
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

    //grab the sortable-item component class that was dropped
    let draggedItem = items.findBy('wasDropped', true);
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

    /**
      020: Run some functions on each sortable-item components
      http://emberjs.com/api/classes/Ember.Array.html#method_invoke
        Invokes the named method on every object in the receiver that implements it.
    **/

    //run sortable-item.freeze();
    //set css transition to none.
    run.schedule('render', () => {
      items.invoke('freeze');
    });

    //delete this._y of sortable-item. It needs to init new y position on the next startDrag, as everything has moved.
    //removes transform.
    run.schedule('afterRender', () => {
      items.invoke('reset');
    });

    //removes transform again.
    run.next(() => {
      run.schedule('render', () => {
        items.invoke('thaw');
      });
    });

    if (groupModel !== NO_MODEL) {
      invokeAction(this, 'onChange', groupModel, itemModels, draggedModel);
    } else {
      invokeAction(this, 'onChange', itemModels, draggedModel);
    }
  }
});
