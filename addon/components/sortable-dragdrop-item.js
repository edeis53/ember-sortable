import Ember from 'ember';
import layout from '../templates/components/sortable-dragdrop-item';
import CoordinateGroupsMixin from '../mixins/coordinate-groups'; //swap SortableItemMixin for CoordinateGroupsMixin

export default Ember.Component.extend(CoordinateGroupsMixin, {
  layout
});
