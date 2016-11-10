import Ember from 'ember';
import SortableItemDocMixin from 'ember-sortable/mixins/sortable-item-doc';
import { module, test } from 'qunit';

module('Unit | Mixin | sortable item doc');

// Replace this with your real tests.
test('it works', function(assert) {
  let SortableItemDocObject = Ember.Object.extend(SortableItemDocMixin);
  let subject = SortableItemDocObject.create();
  assert.ok(subject);
});
