import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('sortable-group-doc', 'Integration | Component | sortable group doc', {
  integration: true
});

test('it renders', function(assert) {
  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{sortable-group-doc}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#sortable-group-doc}}
      template block text
    {{/sortable-group-doc}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
