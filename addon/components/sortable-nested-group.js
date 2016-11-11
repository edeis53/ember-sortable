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
    @property items
    @type Ember.NativeArray
  */
  items: computed(() => a()),

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
      var parent = this.get('items').findBy('elementId', item.parent.elementId);
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
      var parent = this.get('items').findBy('elementId', item.parent.elementId);
      parent.get('children').removeObject(item);
    } else {
        this.get('items').removeObject(item);
    }

  },


});
