import Ember from 'ember';
import CoordinateGroupsMixin from 'ember-sortable/mixins/coordinate-groups';
import { module, test } from 'qunit';

module('Unit | Mixin | coordinate groups');

// Replace this with your real tests.
test('it works', function(assert) {
  let CoordinateGroupsObject = Ember.Object.extend(CoordinateGroupsMixin);
  let subject = CoordinateGroupsObject.create();
  assert.ok(subject);
});
