import Ember from 'ember';
import layout from '../templates/components/sortable-dragdrop-group';

import SortableGroupComponent from './sortable-group';

export default SortableGroupComponent.extend({
  layout,

  dragCoordinator: Ember.inject.service(),
  sortingScope: 'default-scope', //default same scope for all groups

  didInsertElement() {
      this.get('dragCoordinator').pushSortComponent(this);
  },

  willDestroyElement() {
      this.get('dragCoordinator').removeSortComponent(this);
  },

});
