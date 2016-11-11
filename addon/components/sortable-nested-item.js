import Ember from 'ember';
import layout from '../templates/components/sortable-nested-item';
import SortableNestedItemMixin from '../mixins/sortable-nested-item';

export default Ember.Component.extend(SortableNestedItemMixin, {
  layout
});
