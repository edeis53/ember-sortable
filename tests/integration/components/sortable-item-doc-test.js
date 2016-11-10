import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('sortable-item-doc', 'Integration | Component | sortable item doc', {
  integration: true
});

test('it renders', function(assert) {
  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{sortable-item-doc}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#sortable-item-doc}}
      template block text
    {{/sortable-item-doc}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
