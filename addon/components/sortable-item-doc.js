import Ember from 'ember';
import layout from '../templates/components/sortable-item-doc';
import SortableItemDocMixin from '../mixins/sortable-item-doc';

export default Ember.Component.extend(SortableItemDocMixin, {
  layout
});
