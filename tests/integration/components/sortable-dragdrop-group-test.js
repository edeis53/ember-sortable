import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('sortable-dragdrop-group', 'Integration | Component | sortable dragdrop group', {
  integration: true
});

test('it renders', function(assert) {
  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{sortable-dragdrop-group}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#sortable-dragdrop-group}}
      template block text
    {{/sortable-dragdrop-group}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
